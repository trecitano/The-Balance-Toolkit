use anyhow::Result;

use crate::NINTENDO_BOARD_ID;
use crate::actors::bluetooth_service::{
    BluetoothAdapterInfo, BluetoothHandler, BluetoothPeripheral,
};
use crate::types::MacAddress;
use async_trait::async_trait;
use bluer::{AdapterEvent, Address, Device, Session};
use futures::future::join_all;
use futures::stream::StreamExt;
use std::collections::HashSet;
use std::time::Duration;
use tokio::sync::{Mutex, mpsc};

/// Upper bound for a single scan attempt. The Bluetooth actor restarts us after each return.
const SCAN_TIMEOUT: Duration = Duration::from_secs(60);

#[derive(Default)]
pub struct NativeBluetoothHandler {
    /// A BlueZ session is a D-Bus connection plus a background task, which is far too
    /// expensive to set up for every device query. One is kept for the life of the handler
    /// and re-created only if it stops working.
    session: Mutex<Option<Session>>,
}

impl NativeBluetoothHandler {
    async fn session(&self) -> Result<Session> {
        let mut guard = self.session.lock().await;
        if let Some(session) = guard.as_ref() {
            return Ok(session.clone());
        }
        let session = Session::new().await?;
        *guard = Some(session.clone());
        Ok(session)
    }

    async fn reset_session(&self) {
        *self.session.lock().await = None;
    }
}

#[async_trait]
impl BluetoothHandler for NativeBluetoothHandler {
    async fn get_all_bluetooth_adapters_info(&self) -> Result<Vec<Result<BluetoothAdapterInfo>>> {
        let session = self.session().await?;

        // Get all available Bluetooth adapters
        let adapter_names = match session.adapter_names().await {
            Ok(names) => names,
            Err(e) => {
                // The daemon may have restarted under us; start fresh next time.
                self.reset_session().await;
                return Err(e.into());
            }
        };

        // Create futures for each adapter to collect information
        let session_ref = &session;
        let adapter_futures = adapter_names.into_iter().map(|adapter_name| async move {
            let adapter = session_ref.adapter(&adapter_name)?;

            // Get basic adapter information
            let adapter_friendly_name = adapter.alias().await?;
            let adapter_name = adapter.name();
            let mac_address = adapter.address().await?.0;
            let is_active = adapter.is_powered().await?;

            // Get all devices associated with this adapter
            let mut devices: Vec<Result<BluetoothPeripheral>> = Vec::new();

            // Discover devices if adapter is powered on
            if is_active {
                // Get already known devices
                let device_addresses = adapter.device_addresses().await?;

                for address in device_addresses {
                    // One unreadable device must not hide the rest of the adapter.
                    let peripheral = match adapter.device(address) {
                        Ok(device) => convert_to_bluetooth_peripheral(device).await,
                        Err(e) => Err(e.into()),
                    };
                    devices.push(peripheral);
                }
            }

            Ok(BluetoothAdapterInfo {
                id: adapter_friendly_name,
                name: adapter_name.to_string(),
                mac_address: convert_address_to_u64(mac_address),
                is_active,
                devices,
            })
        });

        // Collect information for all adapters
        let adapter_list = join_all(adapter_futures).await;

        Ok(adapter_list)
    }

    // The Linux Bluetooth stack (BlueZ) already has support for pairing and connecting to wiimotes
    // out of the box.
    //
    // This is accomplished by the wiimote plugin, which answers the PIN request with the
    // reversed adapter address (sync-button pairing) for devices named "Nintendo RVL-*".
    // (link: https://github.com/bluez/bluez/blob/master/plugins/wiimote.c)
    //
    // Currently this is bugged https://github.com/bluez/bluez/issues/911 (versions 5.72 to 5.79)
    // but it has already been fixed in Master and should be fixed in 5.80.
    //
    // BlueZ creates the device object as soon as the inquiry response arrives and resolves the
    // remote name afterwards, so a brand-new board usually shows up without a name first. We
    // therefore listen to the "with changes" discovery stream, which re-emits `DeviceAdded`
    // whenever a device property (such as the name) changes.
    async fn scan_and_pair_nintendo(
        &self,
        response_stream: mpsc::Sender<BluetoothPeripheral>,
    ) -> Result<()> {
        let session = self.session().await?;

        let adapter = session.default_adapter().await?;

        let mut events = adapter.discover_devices_with_changes().await?;

        // Addresses we already tried to pair during this attempt. A failed pairing is retried
        // by the next attempt (the actor restarts us), not on every property change.
        let mut attempted: HashSet<Address> = HashSet::new();

        let scan = async {
            while let Some(event) = events.next().await {
                let AdapterEvent::DeviceAdded(addr) = event else {
                    continue;
                };
                if attempted.contains(&addr) {
                    continue;
                }

                let device = match adapter.device(addr) {
                    Ok(device) => device,
                    Err(e) => {
                        log::warn!("Error accessing device {}: {}", addr, e);
                        continue;
                    }
                };

                // The name may still be unresolved; a later change event will bring it.
                let Ok(Some(name)) = device.name().await else {
                    continue;
                };
                if name != NINTENDO_BOARD_ID {
                    continue;
                }

                attempted.insert(addr);
                log::info!("Found Nintendo balance board! Attempting to pair...");

                if let Ok(true) = pair_and_connect(&device).await {
                    let peripheral = convert_to_bluetooth_peripheral(device).await?;
                    let _ = response_stream.send(peripheral).await;
                    log::info!("Successfully connected to the device!");
                    return Ok(true);
                }
            }

            Ok::<bool, anyhow::Error>(false)
        };

        match tokio::time::timeout(SCAN_TIMEOUT, scan).await {
            Ok(result) => result.map(|_| ()),
            Err(_) => {
                log::debug!("Discovery timeout reached");
                Ok(())
            }
        }
    }

    async fn remove_device(&self, mac_address: MacAddress) -> Result<()> {
        let session = self.session().await?;

        // Get all adapters to search for the device
        let adapter_names = session.adapter_names().await?;

        for adapter_name in adapter_names {
            let adapter = session.adapter(&adapter_name)?;

            // Get all device addresses for this adapter
            let device_addresses = adapter.device_addresses().await?;

            for device_addr in device_addresses {
                let device = adapter.device(device_addr)?;
                let device_mac = convert_address_to_u64(device.address().0);

                if device_mac == mac_address {
                    log::debug!("Found device to remove: {}", device_addr);

                    // First disconnect if connected
                    if device.is_connected().await.unwrap_or(false) {
                        log::debug!("Disconnecting device...");
                        if let Err(e) = device.disconnect().await {
                            log::warn!("Failed to disconnect device: {}", e);
                            // Continue with removal even if disconnect fails
                        }
                    }

                    // Removing the device from the adapter also drops its pairing.
                    log::debug!("Removing device from adapter...");
                    adapter.remove_device(device_addr).await?;

                    log::info!("Device successfully removed");
                    return Ok(());
                }
            }
        }

        // Device not found - this is not necessarily an error
        log::warn!("Device with MAC address {:012x} not found", mac_address);
        Ok(())
    }
}

/// Trusts, pairs (if needed) and connects the device. Returns `Ok(true)` when the device ended
/// up connected, `Ok(false)` when pairing or connecting did not complete.
async fn pair_and_connect(device: &Device) -> Result<bool> {
    // Trusted devices are allowed to reconnect on their own later.
    log::debug!("Trusting device");
    device.set_trusted(true).await?;

    if device.is_paired().await? {
        log::debug!("Device is already paired");
    } else {
        log::debug!("Starting pairing...");
        match device.pair().await {
            Ok(()) => log::debug!("Pairing successful!"),
            Err(e) => {
                log::warn!("Pairing failed: {}", e);
                return Ok(false);
            }
        }
    }

    if !device.is_paired().await.unwrap_or(false) {
        log::warn!("Pairing did not complete; will retry on the next scan.");
        return Ok(false);
    }

    log::debug!("Connecting to the device...");
    if let Err(e) = device.connect().await {
        log::warn!("Failed to connect: {}", e);
        return Ok(false);
    }

    Ok(true)
}

async fn convert_to_bluetooth_peripheral(device: Device) -> Result<BluetoothPeripheral> {
    let device_name: String = device.name().await?.unwrap_or_default();
    let mac = device.address().0;
    let id = format!(
        "{:02x}:{:02x}:{:02x}:{:02x}:{:02x}:{:02x}",
        mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]
    );
    let device_address = device.address().0;
    let is_paired = device.is_paired().await?;
    let is_connected = device.is_connected().await?;

    Ok(BluetoothPeripheral {
        id,
        name: device_name,
        mac_address: convert_address_to_u64(device_address),
        is_paired,
        is_connected,
    })
}

fn convert_address_to_u64(mac_address: [u8; 6]) -> MacAddress {
    let b = mac_address;
    ((b[0] as u64) << 40)
        | ((b[1] as u64) << 32)
        | ((b[2] as u64) << 24)
        | ((b[3] as u64) << 16)
        | ((b[4] as u64) << 8)
        | (b[5] as u64)
}
