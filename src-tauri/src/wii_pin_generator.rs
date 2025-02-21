use anyhow::{anyhow, Result};
use futures::future::join_all;

#[cfg(target_os = "windows")]
use windows::{
    Devices::Enumeration::DeviceInformation,
    Devices::Bluetooth::BluetoothAdapter,
};


#[cfg(target_os = "linux")]
use bluez_async::BluetoothSession;

#[derive(Debug)]
pub struct BluetoothAdapterInfo {
    name: String,
    mac_address: String, // # u64 as upper hex string
    wii_board_pin: String
}

pub async fn get_all_bluetooth_adapters_info() -> Result<Vec<Result<BluetoothAdapterInfo>>> {
    bluetooth_mac_address_as_hex().await
}

#[cfg(target_os = "linux")]
async fn bluetooth_mac_address_as_hex() -> Result<String> {
    let (_, session) = BluetoothSession::new().await;

    let adapters = session.get_adapters().await;
    let first_adapter = adapters.first();
    let addr = first_adapter.mac_address;

    addr.to_string().replace(":", "")
}

#[cfg(target_os = "windows")]
async fn bluetooth_mac_address_as_hex() -> Result<Vec<Result<BluetoothAdapterInfo>>> {

    // Get the selector string for Bluetooth adapters
    let selector = BluetoothAdapter::GetDeviceSelector()?;

    // Find all Bluetooth devices
    let devices = DeviceInformation::FindAllAsyncAqsFilter(&selector)?
        .await?;

    // Create a vector of futures
    let futures = devices
        .into_iter()
        .map(|device| async move {
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
