// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "linux")]
use bluez_async::BluetoothSession;

#[tokio::main]
async fn main() {
    let bluetooth_address = bluetooth_mac_address_as_hex().await;
    println!("Addr is {}", bluetooth_address);
    let wii_pin = address_to_wii_pin(bluetooth_address).await.unwrap();
    println!("Pin is {}", wii_pin);
    //   println!("{}", address_to_wii_pin().await.unwrap()); // Removed :s and fixed extra parenthesis
    //balance_toolkit_app_lib::run()
}

#[cfg(target_os = "linux")]
async fn bluetooth_mac_address_as_hex() -> String {
    let (_, session) = BluetoothSession::new().await.unwrap();

    let adapters = session.get_adapters().await.unwrap();
    let first_adapter = adapters.first().unwrap();
    let addr = first_adapter.mac_address;

    addr.to_string().replace(":", "")
}

#[cfg(target_os = "windows")]
async fn bluetooth_mac_address() {}

use anyhow::{anyhow, Result};

// https://github.com/lshachar/WiiBalanceWalker/blob/f44c8d8fff96f6fef7b1ccf9336c09fc0a01dbcd/WiiBalanceWalker/FormBluetooth.cs#L143
pub async fn address_to_wii_pin(bluetooth_mac_address: String) -> Result<String> {
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

        let value = u8::from_str_radix(hex, 16)?;
        bluetooth_pin.push(value as char);
    }

    if double_zero_in_addr {
        // Note: You'll need to implement double_zero_msg_box() equivalent
        // or handle this case differently in Rust
        return Ok("Invalid bt MAC address".to_string());
    }

    Ok(bluetooth_pin)
}
