use anyhow::Result;

use crate::NINTENDO_BOARD_ID;
use crate::actors::bluetooth_service::{
    BluetoothAdapterInfo, BluetoothHandler, BluetoothPeripheral,
};
use crate::types::MacAddress;
use async_trait::async_trait;
use bluer::{AdapterEvent, Device, DeviceEvent, DeviceProperty, Session};
use futures::future::join_all;
use futures::stream::StreamExt;
use std::time::{Duration, Instant};
use tokio::sync::{Mutex, mpsc};

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
                    let device = adapter.device(address)?;
                    let bluetooth_peripheral = convert_to_bluetooth_peripheral(device).await?;

                    devices.push(Ok(bluetooth_peripheral));
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
    // This is accomplished by the autopair.c code, found in the drivers.
    // (link: https://github.com/bluez/bluez/blob/f4617c531abe2cd263ce3b9ba7ba77dc5859215c/plugins/autopair.c#L33-L105)
    //
    // Currently this is bugged https://github.com/bluez/bluez/issues/911 (versions 5.72 to 5.79)
    // but it has already been fixed in Master and should be fixed in 5.80.
    async fn scan_and_pair_nintendo(
        &self,
        response_stream: mpsc::Sender<BluetoothPeripheral>,
    ) -> Result<()> {
        let session = self.session().await?;

        let adapter = session.default_adapter().await?;

        let mut events = adapter.discover_devices().await?;

        // Set timeout for scanning
        let timeout = Duration::from_secs(60);
        let start_time = Instant::now();

        while let Some(event) = events.next().await {
            // Check if we've exceeded the timeout
            if start_time.elapsed() > timeout {
                log::debug!("Discovery timeout reached");
                break;
            }

            if let AdapterEvent::DeviceAdded(addr) = event {
                // Try to get the device
                match adapter.device(addr) {
                    Ok(device) => {
                        // Get device name
                        if let Ok(Some(name)) = device.name().await {
                            // log::info!("Discovered device: {} ({})", name, addr);

                            if name == NINTENDO_BOARD_ID {
                                log::info!("Found Nintendo balance board! Attempting to pair...");

                                if device.is_paired().await.unwrap_or(false) {
                                    log::debug!("Device is already paired");
                                }

                                // Register for pairing events
                                let mut device_events = device.events().await?;

                                // Process the device events (logging)
                                let _handle = tokio::spawn(async move {
                                    while let Some(event) = device_events.next().await {
                                        match event {
                                            DeviceEvent::PropertyChanged(
                                                DeviceProperty::Paired(paired),
                                            ) => {
                                                if paired {
                                                    log::info!("Device successfully paired!");
                                                }
                                            }
                                            DeviceEvent::PropertyChanged(prop) => {
                                                log::debug!("Device property changed: {:?}", prop);
                                            }
                                        }
                                    }
                                });

                                // Set the device to connectable and pairable
                                log::debug!("Trusting device");
                                device.set_trusted(true).await?;

                                // Attempt to pair
                                if !device.is_paired().await? {
                                    log::debug!("Starting pairing...");
                                    let pair_fut = device.pair();

                                    match pair_fut.await {
                                        Ok(_) => log::debug!("Pairing successful!"),
                                        Err(e) => log::warn!("Pairing failed: {}", e),
                                    }
                                }

                                // Try to connect after pairing
                                if device.is_paired().await.unwrap_or(false) {
                                    log::debug!("Connecting to the device...");
                                    if let Err(e) = device.connect().await {
                                        log::warn!("Failed to connect: {}", e);
                                    } else {
                                        let peripheral =
                                            convert_to_bluetooth_peripheral(device).await?;
                                        let _ = response_stream.send(peripheral).await;
                                        log::info!("Successfully connected to the device!");
                                    }
                                    return Ok(());
                                } else {
                                    log::warn!(
                                        "Pairing did not complete; will retry on the next scan."
                                    );
                                }
                            }
                        }
                    }
                    Err(e) => {
                        log::warn!("Error accessing device {}: {}", addr, e);
                    }
                }
            }
        }

        Ok(())
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
