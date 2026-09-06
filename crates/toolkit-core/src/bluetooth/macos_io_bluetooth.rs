// In-process port of the former `macos-wii-balance-pair` helper binary.
//
// Apple is something else.
// https://bugs.dolphin-emu.org/issues/12662
// https://bugs.dolphin-emu.org/issues/12662#note-18
//
// IOBluetooth delivers its delegate callbacks on the run loop of the thread
// that called `start()`. `scan_and_pair_blocking` is therefore meant to be
// invoked on a dedicated OS thread whose run loop this function pumps itself.
// `collect_connected_devices` / `remove_device_by_mac` are synchronous and
// safe to call from a blocking worker thread.
#![allow(unsafe_op_in_unsafe_fn)]

use objc2::rc::{Retained, autoreleasepool};
use objc2::runtime::{AnyClass, AnyObject, NSObject, NSObjectProtocol};
use objc2::{AnyThread, ClassType, DefinedClass, define_class, msg_send};
use objc2_foundation::{NSArray, NSDate, NSNumber, NSRunLoop};
use objc2_io_bluetooth::{
    IOBluetoothDevice, IOBluetoothDeviceInquiry, IOBluetoothDeviceInquiryDelegate,
    IOBluetoothDevicePair, IOBluetoothDevicePairDelegate, IOBluetoothHostController,
};
use std::cell::RefCell;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Sender};
use std::time::Duration;

const TARGET_NAME: &str = "Nintendo RVL-WBC-01";

/// Upper bound for a single scan-and-pair attempt. The Bluetooth actor calls
/// this repeatedly in a loop, so each attempt is intentionally short-lived.
const SCAN_DEADLINE: Duration = Duration::from_secs(60);

#[derive(Debug, Clone)]
pub struct PeripheralOut {
    pub id: String,
    pub name: String,
    pub mac_address: u64,
    pub is_paired: bool,
    pub is_connected: bool,
}

// -------------------- System View ---------------------

pub fn collect_connected_devices() -> Vec<PeripheralOut> {
    autoreleasepool(|_| unsafe { collect_connected_devices_inner() })
}

unsafe fn collect_connected_devices_inner() -> Vec<PeripheralOut> {
    let mut out = Vec::new();

    let paired: Option<Retained<NSArray<AnyObject>>> = IOBluetoothDevice::pairedDevices();
    if let Some(paired) = paired {
        for obj in paired.iter() {
            let dev: &IOBluetoothDevice =
                unsafe { std::mem::transmute(Retained::<AnyObject>::as_ptr(&obj)) };
            if unsafe { dev.isConnected() } {
                out.push(unsafe { peripheral_out_from_device(dev) });
            }
        }
    }

    let recent: Option<Retained<NSArray<AnyObject>>> = IOBluetoothDevice::recentDevices(255);
    if let Some(recent) = recent {
        for obj in recent.iter() {
            let dev: &IOBluetoothDevice =
                unsafe { std::mem::transmute(Retained::<AnyObject>::as_ptr(&obj)) };
            if unsafe { dev.isConnected() }
                && !out.iter().any(|p| p.id == unsafe { id_from_device(dev) })
            {
                out.push(unsafe { peripheral_out_from_device(dev) });
            }
        }
    }

    out
}

unsafe fn peripheral_out_from_device(dev: &IOBluetoothDevice) -> PeripheralOut {
    let id = unsafe { id_from_device(dev) };
    let name = unsafe { dev.name() }.to_string();
    let mac_address = parse_mac_to_u64(
        unsafe { dev.addressString() }
            .map(|s| s.to_string())
            .as_deref(),
    );
    let is_paired = unsafe { dev.isPaired() };
    let is_connected = unsafe { dev.isConnected() };

    PeripheralOut {
        id,
        name,
        mac_address,
        is_paired,
        is_connected,
    }
}

unsafe fn id_from_device(dev: &IOBluetoothDevice) -> String {
    unsafe { dev.addressString() }
        .map(|s| s.to_string())
        .unwrap_or_else(|| unsafe { dev.name() }.to_string())
}

fn parse_mac_to_u64(s: Option<&str>) -> u64 {
    let Some(s) = s else { return 0 };
    let mut bytes = [0u8; 6];
    let parts: Vec<&str> = if s.contains(':') {
        s.split(':').collect()
    } else if s.contains('-') {
        s.split('-').collect()
    } else if s.len() == 12 {
        (0..6).map(|i| &s[i * 2..i * 2 + 2]).collect()
    } else {
        return 0;
    };
    if parts.len() != 6 {
        return 0;
    }
    for (i, part) in parts.iter().enumerate() {
        if let Ok(v) = u8::from_str_radix(part, 16) {
            bytes[i] = v;
        } else {
            return 0;
        }
    }
    ((bytes[0] as u64) << 40)
        | ((bytes[1] as u64) << 32)
        | ((bytes[2] as u64) << 24)
        | ((bytes[3] as u64) << 16)
        | ((bytes[4] as u64) << 8)
        | (bytes[5] as u64)
}

// -------------------- Scan & Pair ---------------------

/// Runs a Bluetooth inquiry and pairs the first Wii Balance Board found.
///
/// Must be called on a dedicated thread: this function owns and pumps that
/// thread's run loop so IOBluetooth delegate callbacks can be delivered.
/// `stop` is polled every pump iteration; setting it aborts the inquiry
/// promptly and returns `Err`.
pub fn scan_and_pair_blocking(stop: Arc<AtomicBool>) -> Result<PeripheralOut, String> {
    autoreleasepool(|_| unsafe { scan_and_pair_inner(stop) })
}

unsafe fn scan_and_pair_inner(stop: Arc<AtomicBool>) -> Result<PeripheralOut, String> {
    let (tx, rx) = mpsc::channel::<PeripheralOut>();

    let delegate = DeviceInquiryDelegate::new(tx);
    let inquiry: Retained<IOBluetoothDeviceInquiry> =
        unsafe { IOBluetoothDeviceInquiry::inquiryWithDelegate(Some(delegate.as_super())) }
            .ok_or_else(|| "Failed to create IOBluetoothDeviceInquiry".to_string())?;

    unsafe { inquiry.setInquiryLength(10) };
    let result = unsafe { inquiry.start() };
    if result != 0 {
        return Err(format!("Inquiry failed to start: {}", result));
    }

    let deadline = std::time::Instant::now() + SCAN_DEADLINE;
    let run_loop = NSRunLoop::currentRunLoop();

    let (outcome, aborting): (Result<PeripheralOut, String>, bool) = loop {
        if stop.load(Ordering::SeqCst) {
            break (Err("scan cancelled".into()), true);
        }
        if let Ok(dev) = rx.try_recv() {
            break (Ok(dev), false);
        }
        if std::time::Instant::now() >= deadline {
            break (Err("Timed out waiting for scan-and-pair".into()), true);
        }
        autoreleasepool(|_| {
            let end_date = NSDate::dateWithTimeIntervalSinceNow(0.1);
            run_loop.runUntilDate(&end_date);
        });
    };

    // Stopping the inquiry does not synchronously detach the delegate:
    // IOBluetooth still delivers a terminal `deviceInquiryComplete:` callback
    // (and, when aborting a pair in flight, pairing-teardown callbacks). Those
    // target `delegate`, which is unretained by IOBluetooth. If we return now
    // the delegate is freed and the pending callback lands in freed memory
    // (SIGSEGV). So: stop, then keep the delegate alive and keep pumping the
    // run loop until IOBluetooth has finished calling back, *then* return
    // (which is where `delegate` and any held pair objects are released).
    let _ = unsafe { inquiry.stop() };

    if aborting {
        if let Some((pair, _)) = delegate.ivars().held.borrow().as_ref() {
            let pair_ref: &IOBluetoothDevicePair = pair;
            let _: () = unsafe { msg_send![pair_ref, stop] };
        }
    }

    let drain_deadline = std::time::Instant::now() + Duration::from_millis(800);
    while std::time::Instant::now() < drain_deadline {
        autoreleasepool(|_| {
            let end_date = NSDate::dateWithTimeIntervalSinceNow(0.05);
            run_loop.runUntilDate(&end_date);
        });
    }

    // The inquiry (and any IOBluetoothDevicePair) is autoreleased: its
    // `dealloc` runs later, when the enclosing autorelease pool drains, after
    // this function has returned and our `Retained` delegates are already
    // freed. Sever the framework -> delegate back-pointers now, while the
    // delegates are still alive, so the deferred dealloc cannot message freed
    // memory.
    if let Some((pair, _pair_delegate)) = delegate.ivars().held.borrow_mut().take() {
        pair.setDelegate(None);
        // `pair` / `_pair_delegate` drop here, deterministically, while
        // `inquiry` and `delegate` are still alive.
    }
    let _: () = unsafe { msg_send![&*inquiry, setDelegate: core::ptr::null_mut::<AnyObject>()] };

    outcome
}

// -------------------- Remove Device ---------------------

pub fn remove_device_by_mac(mac_str: &str) -> Result<(), String> {
    autoreleasepool(|_| unsafe { remove_device_by_mac_inner(mac_str) })
}

unsafe fn remove_device_by_mac_inner(mac_str: &str) -> Result<(), String> {
    let norm = mac_str.replace(':', "-").to_uppercase();

    let mut target: Option<Retained<IOBluetoothDevice>> = None;
    let paired: Option<Retained<NSArray<AnyObject>>> = IOBluetoothDevice::pairedDevices();
    if let Some(paired) = paired {
        for obj in paired.iter() {
            let dev: &IOBluetoothDevice =
                unsafe { std::mem::transmute(Retained::<AnyObject>::as_ptr(&obj)) };
            if let Some(addr) = unsafe { dev.addressString() } {
                let a = addr.to_string().to_uppercase();
                if a == norm {
                    let dev_ptr = dev as *const IOBluetoothDevice as *mut IOBluetoothDevice;
                    target = Some(unsafe { Retained::retain(dev_ptr).unwrap() });
                    break;
                }
            }
        }
    }

    if target.is_none() {
        let recent: Option<Retained<NSArray<AnyObject>>> = IOBluetoothDevice::recentDevices(255);
        if let Some(recent) = recent {
            for obj in recent.iter() {
                let dev: &IOBluetoothDevice =
                    unsafe { std::mem::transmute(Retained::<AnyObject>::as_ptr(&obj)) };
                if let Some(addr) = unsafe { dev.addressString() } {
                    let a = addr.to_string().to_uppercase();
                    if a == norm {
                        let dev_ptr = dev as *const IOBluetoothDevice as *mut IOBluetoothDevice;
                        target = Some(unsafe { Retained::retain(dev_ptr).unwrap() });
                        break;
                    }
                }
            }
        }
    }

    let Some(dev) = target else {
        log::debug!(
            "Device {} not found in paired/recent devices, treating as already removed",
            mac_str
        );
        return Ok(());
    };

    let close_status: i32 = unsafe { msg_send![&dev, closeConnection] };
    if close_status != 0 {
        log::warn!("closeConnection returned {}", close_status);
    }

    let _: () = unsafe { msg_send![&dev, remove] };

    Ok(())
}

// -------------------- Delegates ---------------------

pub struct DeviceInquiryDelegateIvars {
    tx: Sender<PeripheralOut>,
    // Keeps the in-flight pair + its delegate alive for the duration of the
    // scan. Replaces the original `std::mem::forget`, which leaked one of each
    // per scan attempt now that this runs in a long-lived process.
    held: RefCell<
        Option<(
            Retained<IOBluetoothDevicePair>,
            Retained<DevicePairDelegate>,
        )>,
    >,
}

define_class!(
    #[unsafe(super(NSObject))]
    #[ivars = DeviceInquiryDelegateIvars]
    pub struct DeviceInquiryDelegate;

    unsafe impl NSObjectProtocol for DeviceInquiryDelegate {}

    unsafe impl IOBluetoothDeviceInquiryDelegate for DeviceInquiryDelegate {
        #[unsafe(method(deviceInquiryStarted:))]
        unsafe fn device_inquiry_started(&self, _sender: Option<&IOBluetoothDeviceInquiry>) {}

        #[unsafe(method(deviceInquiryDeviceFound:device:))]
        unsafe fn device_found(
            &self,
            sender: &IOBluetoothDeviceInquiry,
            device: &IOBluetoothDevice,
        ) {
            let device_name = unsafe { device.name().to_string() };

            if device_name != TARGET_NAME {
                sender.clearFoundDevices();
                return;
            }

            if device.isPaired() {
                return;
            }

            sender.stop();

            let device_pair = match IOBluetoothDevicePair::pairWithDevice(Some(device)) {
                Some(p) => p,
                None => return,
            };
            let pair_delegate = DevicePairDelegate::new(self.ivars().tx.clone());
            device_pair.setDelegate(Some(pair_delegate.as_super()));

            let _: () = msg_send![&device_pair, setUserDefinedPincode: true];
            let result = device_pair.start();

            // Keep both alive until the scan completes instead of leaking them.
            *self.ivars().held.borrow_mut() = Some((device_pair, pair_delegate));

            if result != 0 {
                // Pairing failed to start; the held objects are dropped when
                // the scan ends.
            }
        }

        #[unsafe(method(deviceInquiryComplete:error:aborted:))]
        fn inquiry_complete(
            &self,
            _sender: &IOBluetoothDeviceInquiry,
            _error: u32,
            _aborted: bool,
        ) {
        }
    }
);

impl DeviceInquiryDelegate {
    fn new(tx: Sender<PeripheralOut>) -> Retained<Self> {
        let ivars = DeviceInquiryDelegateIvars {
            tx,
            held: RefCell::new(None),
        };
        let this = Self::alloc().set_ivars(ivars);
        unsafe { msg_send![super(this), init] }
    }
}

pub struct DevicePairDelegateIvars {
    tx: Sender<PeripheralOut>,
}

define_class!(
    #[unsafe(super(NSObject))]
    #[ivars = DevicePairDelegateIvars]
    pub struct DevicePairDelegate;

    unsafe impl NSObjectProtocol for DevicePairDelegate {}

    unsafe impl IOBluetoothDevicePairDelegate for DevicePairDelegate {
        #[unsafe(method(devicePairingStarted:))]
        fn device_pairing_started(&self, _sender: Option<&AnyObject>) {}

        // Provide PIN using private API; Wii expects reversed host MAC as PIN.
        #[unsafe(method(devicePairingPINCodeRequest:))]
        fn device_pairing_pin_code_request(&self, sender: Option<&AnyObject>) {
            if let Some(sender_obj) = sender {
                let pair_obj: &IOBluetoothDevicePair = unsafe { std::mem::transmute(sender_obj) };

                if let Ok(controller_address) = get_host_controller_address() {
                    let mut pin_bytes = [0u8; 8];
                    for i in 0..6 {
                        pin_bytes[i] = controller_address[5 - i];
                    }
                    let key = u64::from_le_bytes(pin_bytes);

                    unsafe {
                        let coordinator_class =
                            AnyClass::get(c"IOBluetoothCoreBluetoothCoordinator")
                                .expect("IOBluetoothCoreBluetoothCoordinator not found");
                        let coordinator: *const AnyObject =
                            msg_send![coordinator_class, sharedInstance];

                        let device: *const AnyObject = msg_send![pair_obj, device];
                        let classic_peer: *const AnyObject = msg_send![device, classicPeer];
                        let pairing_type: i64 = msg_send![pair_obj, currentPairingType];

                        let key_number = NSNumber::numberWithUnsignedLongLong(key);

                        let _: () = msg_send![
                            coordinator,
                            pairPeer: classic_peer,
                            forType: pairing_type,
                            withKey: &*key_number
                        ];
                    }
                }
            }
        }

        #[unsafe(method(devicePairingFinished:error:))]
        fn device_pairing_finished_error(&self, sender: Option<&AnyObject>, error: u32) {
            if error == 0 {
                if let Some(sender_obj) = sender {
                    let pair_obj: &IOBluetoothDevicePair =
                        unsafe { std::mem::transmute(sender_obj) };
                    let device_ptr: *const AnyObject = unsafe { msg_send![pair_obj, device] };
                    let dev: &IOBluetoothDevice =
                        unsafe { &*(device_ptr as *const IOBluetoothDevice) };
                    let po = unsafe { peripheral_out_from_device(dev) };
                    let _ = self.ivars().tx.send(po);
                }
            }
        }
    }
);

impl DevicePairDelegate {
    fn new(tx: Sender<PeripheralOut>) -> Retained<Self> {
        let ivars = DevicePairDelegateIvars { tx };
        let this = Self::alloc().set_ivars(ivars);
        unsafe { msg_send![super(this), init] }
    }
}

// -------------------- Helpers ---------------------

fn get_host_controller_address() -> Result<[u8; 6], String> {
    unsafe {
        let controller = IOBluetoothHostController::defaultController()
            .ok_or("Failed to get default Bluetooth controller")?;

        let address_string = controller
            .addressAsString()
            .ok_or("Failed to get controller address")?;

        let address_str = address_string.to_string();

        let parts: Vec<&str> = if address_str.contains(':') {
            address_str.split(':').collect()
        } else if address_str.contains('-') {
            address_str.split('-').collect()
        } else {
            return Err("Invalid address format".to_string());
        };

        if parts.len() != 6 {
            return Err("Invalid address format".to_string());
        }

        let mut address = [0u8; 6];
        for (i, part) in parts.iter().enumerate() {
            address[i] = u8::from_str_radix(part, 16)
                .map_err(|e| format!("Failed to parse address byte: {}", e))?;
        }

        Ok(address)
    }
}
