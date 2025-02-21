use anyhow::{anyhow, Result};

#[cfg(target_os = "windows")]
use windows::{
    Devices::Enumeration::DeviceInformation,
    Devices::Bluetooth::BluetoothAdapter,
};


#[cfg(target_os = "linux")]
use bluez_async::BluetoothSession;

pub async fn generate() -> Result<String> {
    let bluetooth_address = bluetooth_mac_address_as_hex().await?;
    address_to_wii_pin(bluetooth_address).await
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
async fn bluetooth_mac_address_as_hex() -> Result<String> {

    // Get the selector string for Bluetooth adapters
    let selector = BluetoothAdapter::GetDeviceSelector()?;

    // Find all Bluetooth devices
    let devices = DeviceInformation::FindAllAsyncAqsFilter(&selector)?
        .await?;

    if devices.Size()? == 0 {
        println!("No Bluetooth adapters found.");
        return Err(anyhow!("No bluetooth devices were found."));
    }

    // Iterate through all found devices
    for device in devices {
        // Get the device ID
        let id = device.Id()?;
        
        // Create BluetoothAdapter instance
        match BluetoothAdapter::FromIdAsync(&id)?.await {
            Ok(adapter) => {
                let mac_address = adapter.BluetoothAddress()?;
                return Ok(format!("{:X}", mac_address))
            },
            Err(_) => {
                println!("Failed to get adapter for device: {}", device.Name()?);
            }
        }
    }

    Err(anyhow!("Found bluetooth devices, but couldn't get the mac address."))
}


// https://github.com/lshachar/WiiBalanceWalker/blob/f44c8d8fff96f6fef7b1ccf9336c09fc0a01dbcd/WiiBalanceWalker/FormBluetooth.cs#L143
async fn address_to_wii_pin(bluetooth_mac_address: String) -> Result<String> {
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
