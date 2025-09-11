// Apple is something else.
// https://bugs.dolphin-emu.org/issues/12662
// https://bugs.dolphin-emu.org/issues/12662#note-18

use objc2::rc::Retained;
use objc2::runtime::{AnyClass, AnyObject, NSObject, NSObjectProtocol};
use objc2::{define_class, msg_send, AnyThread, ClassType, DefinedClass};
use objc2_foundation::{NSArray, NSDate, NSNumber, NSRunLoop};
use objc2_io_bluetooth::{
    IOBluetoothDevice, IOBluetoothDeviceInquiry, IOBluetoothDeviceInquiryDelegate,
    IOBluetoothDevicePair, IOBluetoothDevicePairDelegate, IOBluetoothHostController,
};
use serde::{Deserialize, Serialize};
use std::env;
use std::sync::mpsc::{self, Sender};
use std::time::Duration;

const TARGET_NAME: &str = "Nintendo RVL-WBC-01";

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() < 2 {
        eprintln!("usage: bluetooth_process <system-view|scan-and-pair|remove <mac>>");
        std::process::exit(2);
    }

    let cmd = args[1].as_str();
    match cmd {
        "system-view" => unsafe {
            let devices = collect_connected_devices();
            println!("{}", serde_json::to_string_pretty(&devices).unwrap());
        },
        "scan-and-pair" => unsafe {
            match cmd_scan_and_pair() {
                Ok(dev) => {
                    println!("{}", serde_json::to_string(&dev).unwrap());
                }
                Err(e) => {
                    eprintln!("{}", e);
                    std::process::exit(1);
                }
            }
        },
        "remove" => unsafe {
            if args.len() < 3 {
                eprintln!("usage: bluetooth_process remove <mac-address>");
                std::process::exit(2);
            }
            match remove_device_by_mac(&args[2]) {
                Ok(()) => {
                    println!(r#"{{"ok":true}}"#);
                }
                Err(e) => {
                    eprintln!("{}", e);
                    std::process::exit(1);
                }
            }
        },
        _ => {
            eprintln!("Unknown command: {}", cmd);
            std::process::exit(2);
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct PeripheralOut {
    id: String,
    name: String,
    mac_address: u64,
    is_paired: bool,
    is_connected: bool,
}

// -------------------- System View ---------------------

#[allow(unsafe_op_in_unsafe_fn)]
unsafe fn collect_connected_devices() -> Vec<PeripheralOut> {
    let mut out = Vec::new();

    let paired: Option<Retained<NSArray<AnyObject>>> =
        IOBluetoothDevice::pairedDevices();
    if let Some(paired) = paired {
        for obj in paired.iter() {
            // Cast AnyObject to IOBluetoothDevice
            let dev: &IOBluetoothDevice = unsafe { std::mem::transmute(Retained::<AnyObject>::as_ptr(&obj)) };
            if unsafe { dev.isConnected() } {
                out.push(unsafe { peripheral_out_from_device(dev) });
            }
        }
    }

    let recent: Option<Retained<NSArray<AnyObject>>> =
        IOBluetoothDevice::recentDevices(255);
    if let Some(recent) = recent {
        for obj in recent.iter() {
            // Cast AnyObject to IOBluetoothDevice
            let dev: &IOBluetoothDevice = unsafe { std::mem::transmute(Retained::<AnyObject>::as_ptr(&obj)) };
            if unsafe { dev.isConnected() }
                && !out.iter().any(|p| p.id == unsafe { id_from_device(dev) })
            {
                out.push(unsafe { peripheral_out_from_device(dev) });
            }
        }
    }

    out
}

#[allow(unsafe_op_in_unsafe_fn)]
unsafe fn peripheral_out_from_device(dev: &IOBluetoothDevice) -> PeripheralOut {
    let id = unsafe { id_from_device(dev) };
    let name = unsafe { dev.name() }.to_string();
    let mac_address =
        parse_mac_to_u64(unsafe { dev.addressString() }.map(|s| s.to_string()).as_deref());
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

#[allow(unsafe_op_in_unsafe_fn)]
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

#[allow(unsafe_op_in_unsafe_fn)]
unsafe fn cmd_scan_and_pair() -> Result<PeripheralOut, String> {
    // Return immediately if already present

    // Channel to receive paired device
    let (tx, rx) = mpsc::channel::<PeripheralOut>();

    let delegate = DeviceInquiryDelegate::new(tx.clone());
    let inquiry: Retained<IOBluetoothDeviceInquiry> =
        unsafe { IOBluetoothDeviceInquiry::inquiryWithDelegate(Some(delegate.as_super())) }
            .unwrap();

    unsafe { inquiry.setInquiryLength(10) };
    let result = unsafe { inquiry.start() };
    if result != 0 {
        return Err(format!("Inquiry failed to start: {}", result));
    }

    // Run up to 120s or until we receive the device
    let deadline = std::time::Instant::now() + Duration::from_secs(120);
    let run_loop = unsafe { NSRunLoop::currentRunLoop() };

    loop {
        if let Ok(dev) = rx.try_recv() {
            let _ = unsafe { inquiry.stop() };
            return Ok(dev);
        }
        if std::time::Instant::now() >= deadline {
            let _ = unsafe { inquiry.stop() };
            return Err("Timed out waiting for scan-and-pair".into());
        }
        let end_date = unsafe { NSDate::dateWithTimeIntervalSinceNow(0.1) };
        let _ = unsafe { run_loop.runUntilDate(&end_date) };
    }
}

// -------------------- Remove Device ---------------------

#[allow(unsafe_op_in_unsafe_fn)]
unsafe fn remove_device_by_mac(mac_str: &str) -> Result<(), String> {
    // Normalize separators for comparison: uppercase + colon
    let norm = mac_str.replace(':', "-").to_uppercase();
    //println!("Comparing to {}", norm);

    // Try paired devices first
    let mut target: Option<Retained<IOBluetoothDevice>> = None;
    let paired: Option<Retained<NSArray<AnyObject>>> =
        IOBluetoothDevice::pairedDevices();
    if let Some(paired) = paired {
        for obj in paired.iter() {
            let dev: &IOBluetoothDevice = unsafe { std::mem::transmute(Retained::<AnyObject>::as_ptr(&obj)) };
            if let Some(addr) = unsafe { dev.addressString() } {
                let a = addr.to_string().to_uppercase();
               //println!("Chekcing {}", a);
                if a == norm {
                    let dev_ptr = dev as *const IOBluetoothDevice as *mut IOBluetoothDevice;
                    target = Some(unsafe { Retained::retain(dev_ptr).unwrap() });
                    break;
                }
            }
        }
    }

    // Fall back to recent devices
    if target.is_none() {
        let recent: Option<Retained<NSArray<AnyObject>>> =
            IOBluetoothDevice::recentDevices(255);
        if let Some(recent) = recent {
            for obj in recent.iter() {
                let dev: &IOBluetoothDevice = unsafe { std::mem::transmute(Retained::<AnyObject>::as_ptr(&obj)) };
                if let Some(addr) = unsafe { dev.addressString() } {
                    let a = addr.to_string().to_uppercase();
                    //println!("Chekcing {}", a);
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
        return Err(format!("Device {} not found", mac_str));
    };

    // If connected, close the connection first (IOReturn == 0 means success)
    let close_status: i32 = unsafe { msg_send![&dev, closeConnection] };
    if close_status != 0 {
        eprintln!("Warning: closeConnection returned {}", close_status);
        // continue anyway
    }

    // Remove/unpair from system (IOReturn)
    let _: () = unsafe { msg_send![&dev, remove] };

    Ok(())
}

// -------------------- Delegates ---------------------

#[derive(Debug)]
pub struct DeviceInquiryDelegateIvars {
    tx: Sender<PeripheralOut>,
}

define_class!(
    #[unsafe(super(NSObject))]
    #[ivars = DeviceInquiryDelegateIvars]
    #[derive(Debug, PartialEq, Eq, Hash)]
    pub struct DeviceInquiryDelegate;

    unsafe impl NSObjectProtocol for DeviceInquiryDelegate {}

    unsafe impl IOBluetoothDeviceInquiryDelegate for DeviceInquiryDelegate {
        #[unsafe(method(deviceInquiryStarted:))]
        unsafe fn device_inquiry_started(&self, sender: Option<&IOBluetoothDeviceInquiry>) {
            //println!("##### Inquiry start");
        }

        #[unsafe(method(deviceInquiryDeviceFound:device:))]
        unsafe fn device_found(&self, sender: &IOBluetoothDeviceInquiry, device: &IOBluetoothDevice) {
            let device_name = unsafe { device.name().to_string() };
            //println!("##### Found device: {}", device_name);

            if device_name != "Nintendo RVL-WBC-01" {
                //println!("Not the balance board, resetting");
                sender.clearFoundDevices();
                return;
            }

            if device.isPaired() {
                return;
            }

            //println!("Device isPaired: {}", device.isPaired());
            //println!("Device isConnected: {}", device.isConnected());
            if let Some(address) = device.addressString() {
                //println!("Device address: {}", address.to_string());
            }

            sender.stop();

            //println!("🔵 Attempting pairing...");
            let device_pair = IOBluetoothDevicePair::pairWithDevice(Some(device)).unwrap();
            let pair_delegate = DevicePairDelegate::new(self.ivars().tx.clone());
            device_pair.setDelegate(Some(pair_delegate.as_super()));

            let _: () = msg_send![&device_pair, setUserDefinedPincode: true];
            let result = device_pair.start();

            std::mem::forget(device_pair);
            std::mem::forget(pair_delegate);

            if result != 0 {
               // println!("❌ Pairing failed to start");
            }
        }

        #[unsafe(method(deviceInquiryComplete:error:aborted:))]
        fn inquiry_complete(&self, sender: &IOBluetoothDeviceInquiry, error: u32, aborted: bool) {
            //println!("#### Device inquiry complete. Error: {}, Aborted: {}", error, aborted);
        }
    }
);

impl DeviceInquiryDelegate {
    fn new(tx: Sender<PeripheralOut>) -> Retained<Self> {
        let ivars = DeviceInquiryDelegateIvars { tx };
        let this = Self::alloc().set_ivars(ivars);
        unsafe { msg_send![super(this), init] }
    }
}

#[derive(Debug)]
pub struct DevicePairDelegateIvars {
    tx: Sender<PeripheralOut>,
}

define_class!(
    #[unsafe(super(NSObject))]
    #[ivars = DevicePairDelegateIvars]
    #[derive(Debug, PartialEq, Eq, Hash)]
    pub struct DevicePairDelegate;

    unsafe impl NSObjectProtocol for DevicePairDelegate {}

    unsafe impl IOBluetoothDevicePairDelegate for DevicePairDelegate {
        #[unsafe(method(devicePairingStarted:))]
        fn device_pairing_started(&self, sender: Option<&AnyObject>) {
          //  println!("🔵🔵 Pairing started");
        }

        // Provide PIN using private API; Wii expects reversed host MAC as PIN
        #[unsafe(method(devicePairingPINCodeRequest:))]
        fn device_pairing_pin_code_request(&self, sender: Option<&AnyObject>) {
            if let Some(sender_obj) = sender {
                let pair_obj: &IOBluetoothDevicePair = unsafe { std::mem::transmute(sender_obj) };

                match get_host_controller_address() {
                    Ok(controller_address) => {
                        let mut pin_bytes = [0u8; 8];
                        for i in 0..6 {
                            pin_bytes[i] = controller_address[5 - i];
                        }
                        let key = u64::from_le_bytes(pin_bytes);

                        unsafe {
                            let coordinator_class = AnyClass::get(c"IOBluetoothCoreBluetoothCoordinator")
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
                    Err(_) => {
                        // If we fail to get controller address, pairing likely fails
                    }
                }
            }
        }

        #[unsafe(method(devicePairingFinished:error:))]
        fn device_pairing_finished_error(&self, sender: Option<&AnyObject>, error: u32) {
            if error == 0 {
                if let Some(sender_obj) = sender {
                    let pair_obj: &IOBluetoothDevicePair = unsafe { std::mem::transmute(sender_obj) };
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