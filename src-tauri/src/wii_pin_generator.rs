use anyhow::{anyhow, Result};

#[cfg(target_os = "windows")]
use futures::future::join_all;
use serde::{Deserialize, Serialize};
#[cfg(target_os = "windows")]
use windows::{Devices::Bluetooth::BluetoothAdapter, Devices::Enumeration::DeviceInformation};

#[cfg(target_os = "linux")]
use bluez_async::BluetoothSession;

#[derive(Debug, Serialize, Deserialize)]
pub struct BluetoothAdapterInfo {
    name: String,
    mac_address: String, // # u64 as upper hex string
    wii_board_pin: String,
}

#[cfg(target_os = "linux")]
pub async fn get_all_bluetooth_adapters_info() -> Result<Vec<Result<BluetoothAdapterInfo>>> {
    let (_, session) = BluetoothSession::new().await?;

    let adapters = session.get_adapters().await?;

    Ok(adapters
        .into_iter()
        .map(|adapter| {
            let mac_address = adapter.mac_address.to_string().replace(":", "");
            let wii_board_pin = address_to_wii_pin(mac_address.clone())?;

            Ok(BluetoothAdapterInfo {
                name: adapter.name,
                mac_address,
                wii_board_pin,
            })
        })
        .collect())
}

#[cfg(target_os = "windows")]
pub async fn get_all_bluetooth_adapters_info() -> Result<Vec<Result<BluetoothAdapterInfo>>> {
    // Get the selector string for Bluetooth adapters
    let selector = BluetoothAdapter::GetDeviceSelector()?;

    // Find all Bluetooth devices
    let devices = DeviceInformation::FindAllAsyncAqsFilter(&selector)?.await?;

    // Create a vector of futures
    let futures = devices.into_iter().map(|device| async move {
        // Get the device ID and name
        let id = device.Id()?;
        let name = device.Name()?;

        // Create BluetoothAdapter instance
        let adapter = BluetoothAdapter::FromIdAsync(&id)?.await?;

        let mac_address = adapter.BluetoothAddress()?;
        let hexa_mac_address = format!("{:X}", mac_address);

        Ok(BluetoothAdapterInfo {
            name: name.to_string(),
            mac_address: hexa_mac_address.clone(),
            wii_board_pin: address_to_wii_pin(hexa_mac_address)?,
        })
    });

    // Wait for all futures to complete
    Ok(join_all(futures).await)
}

// https://github.com/lshachar/WiiBalanceWalker/blob/f44c8d8fff96f6fef7b1ccf9336c09fc0a01dbcd/WiiBalanceWalker/FormBluetooth.cs#L143
fn address_to_wii_pin(bluetooth_mac_address: String) -> Result<String> {
    if bluetooth_mac_address.len() != 12 {
        return Err(anyhow!(
            "Invalid Bluetooth Address: {}",
            bluetooth_mac_address
        ));
    }

    let mut bluetooth_pin = String::new();
    let mut double_zero_in_addr = false;

    // Process address in reverse pairs
    for i in (0..bluetooth_mac_address.len()).rev().step_by(2) {
        if i < 1 {
            break;
        }
        let hex = &bluetooth_mac_address[i - 1..=i];

        if hex == "00" {
            double_zero_in_addr = true;
        }

        let value = u8::from_str_radix(hex, 16).unwrap();
        bluetooth_pin.push(value as char);
    }

    if double_zero_in_addr {
        // Note: You'll need to implement double_zero_msg_box() equivalent
        // or handle this case differently in Rust
        return Ok("Invalid bt MAC address".to_string());
    }

    Ok(bluetooth_pin)
}

// -------------------------------------------------

use btleplug::api::{Central, CharPropFlags, Manager as _, Peripheral, ScanFilter};
use btleplug::platform::{Adapter, Manager};

// Returns a tuple of Adapter ID to
pub async fn all_adapter_bluetooth_connections() -> Result<()> {
    // Then we use the cross platform library to fetch information about the connected peripherals
    let manager = Manager::new().await?;
    let adapter_list = manager.adapters().await?;

    for adapter in adapter_list {
        adapter_bluetooth_connections(adapter).await;
    }

    Ok(())
}

use btleplug::api::{Manager as _, Peripheral as _};
use futures::stream::StreamExt; // This is the important import
use std::error::Error;
use tokio::time::Duration;

pub async fn adapter_bluetooth_connections(adapter: Adapter) -> Result<()> {
    let peripherals = adapter.peripherals().await?;

    for peripheral in peripherals {
        let properties = peripheral.properties().await?.unwrap();
        println!("{:?}", properties);
        println!("Connected: {}", peripheral.is_connected().await?);
        if properties.local_name.unwrap().starts_with("Nintendo") {
            println!("Found ninin!");
            // Get all characteristics
            let chars = peripheral.characteristics();
            // Subscribe to all notifiable characteristics
            println!("{:?}", chars);
            for characteristic in chars.iter() {
                //               if characteristic.properties.contains(CharPropFlags::NOTIFY) {
                println!("Subscribing to characteristic {:?}", characteristic.uuid);
                peripheral.subscribe(&characteristic).await?;
                //             }
            }

            // Listen to notifications
            println!("Subscribed! Listening for notifications...");
            let mut notifications = peripheral.notifications().await?;

            // Process notifications as they arrive
            while let Some(notification) = notifications.next().await {
                println!(
                    "Notification: characteristic = {}, value = {:?}",
                    2, notification.value
                );
            }
        }
    }

    Ok(())
}
