use anyhow::{anyhow, Result};

use crate::bluetooth::bluetooth_communication::{
    BluetoothAdapterInfo, BluetoothPeripheral, better_mac_address_to_wii_pin,
};
use bluer::{Adapter, AdapterEvent, Address, DeviceEvent, DeviceProperty, DiscoveryFilter, DiscoveryTransport, Session};
use futures::future::join_all;
use futures::stream::StreamExt;
use std::collections::HashMap;
use std::ffi::CString;
use std::pin::Pin;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use bluer::agent::{Agent, ReqResult, RequestPinCode, RequestPinCodeFn};
use tokio::task::JoinHandle;
use tokio::time::sleep;
use crate::NINTENDO_BOARD_ID;

pub async fn get_all_bluetooth_adapters_info() -> Result<Vec<Result<BluetoothAdapterInfo>>> {
    // Create a BlueZ session
    let session = Session::new().await?;

    // Get all available Bluetooth adapters
    let adapter_names = session.adapter_names().await?;

    // Create futures for each adapter to collect information
    let session_ref = &session;
    let adapter_futures = adapter_names.into_iter().map(|adapter_name| async move {
        let adapter = session_ref.adapter(&adapter_name)?;

        // Get basic adapter information
        let adapter_friendly_name = adapter.alias().await?;
        let adapter_modalias = adapter.modalias().await?;
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
                let device_name: String = device.name().await?.unwrap_or_default();
                let device_address = device.address().0;
                let is_paired = device.is_paired().await?;
                let is_connected = device.is_connected().await?;

                devices.push(Ok(BluetoothPeripheral {
                    id: address.to_string(),
                    name: device_name,
                    mac_address: device_address,
                    is_paired,
                    is_connected,
                }));
            }
        }

        Ok(BluetoothAdapterInfo {
            id: adapter_friendly_name,
            name: adapter_name.to_string(),
            mac_address,
            wii_board_pin: better_mac_address_to_wii_pin(mac_address),
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
pub async fn scan_and_pair_nintendo(adapter: &BluetoothAdapterInfo) -> Result<()> {
    let session = Session::new().await?;

    println!("Using Bluetooth adapter: {}", adapter.name);
    // TODO LINUX: WE ALREADY KNOW THE ADDRESS, THEN WE DON'T NEED TO ACTIVATE DISCOVER DEVICES?

    let adapter = session.adapter(&adapter.name)?;

    // Set up discovery filter

    let mut events = adapter.discover_devices().await?;

    // Set timeout for scanning
    let timeout = Duration::from_secs(60);
    let start_time = Instant::now();

    while let Some(event) = events.next().await {
        // Check if we've exceeded the timeout
        if start_time.elapsed() > timeout {
            println!("Discovery timeout reached");
            break;
        }

        if let AdapterEvent::DeviceAdded(addr) = event {
            // Try to get the device
            match adapter.device(addr) {
                Ok(device) => {
                    // Get device name
                    if let Ok(Some(name)) = device.name().await {
                        // println!("Discovered device: {} ({})", name, addr);

                        if name == NINTENDO_BOARD_ID {
                            println!("Found Nintendo balance board! Attempting to pair...");

                            // Stop discovery before pairing
                            //adapter.stop_discovery().await?;

                            // Check if device is already paired
                            if let Ok(paired) = device.is_paired().await {
                                if paired {
                                    println!("Device is already paired");
                           //         return Ok(());
                                }
                            }

                            // Register for pairing events
                            let mut device_events = device.events().await?;

                            // Process the device events (logging)
                            let _handle = tokio::spawn(async move {
                                println!("Lets potato time!");
                                while let Some(event) = device_events.next().await {
                                    match event {
                                        DeviceEvent::PropertyChanged(DeviceProperty::Paired(paired)) => {
                                            if paired {
                                                println!("!!! Device successfully paired!");
                                            }
                                        }
                                        DeviceEvent::PropertyChanged(prop) => {
                                            println!("!!! Property changed: {:?}", prop);
                                        }
                                        _ => { println!("!!! {:?}", event); }
                                    }
                                }
                            });

                            // Set the device to connectable and pairable
                            println!("Trusting device");
                            device.set_trusted(true).await?;

                            // Attempt to pair
                            if !device.is_paired().await? {
                                println!("Starting pairing...");
                                let pair_fut = device.pair();

                                match pair_fut.await {
                                    Ok(_) => println!("Pairing successful!"),
                                    Err(e) => println!("Pairing failed: {}", e),
                                }
                            }

                            // Try to connect after pairing
                            if device.is_paired().await.unwrap_or(false) {
                                println!("Connecting to the device...");
                                if let Err(e) = device.connect().await {
                                    println!("Failed to connect: {}", e);
                                } else {
                                    println!("Successfully connected to the device!");
                                }
                                return Ok(());
                            } else {
                                println!("The potato");
                            }
                        }
                    }
                }
                Err(e) => {
                    println!("Error accessing device {}: {}", addr, e);
                }
            }
        }
    }

    // Stop discovery when done
    if adapter.is_discovering().await? {
        println!("Still discovering!");
        //adapter.stop_discovery().await?;
    }

    Ok(())
}
