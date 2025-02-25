use anyhow::{Result, anyhow};

use crate::bluetooth::windows_bluetooth_handler as handler;

#[derive(Debug)]
pub struct BluetoothAdapterInfo {
    pub id: String,
    pub name: String,
    pub mac_address: String, // # u64 as upper hex string
    pub wii_board_pin: String,
    pub is_active: bool,
    pub devices: Vec<Result<BluetoothPeripheral>>,
}

#[derive(Debug)]
pub struct BluetoothPeripheral {
    pub id: String,
    pub name: String,
    pub bluetooth_address: String,
    pub connection_status: bool,
}

pub static NINTENDO_BOARD_ID: &str = "Nintendo RVL-WBC-01";

pub async fn get_all_bluetooth_adapters_info() -> Result<Vec<Result<BluetoothAdapterInfo>>> {
    handler::get_all_bluetooth_adapters_info().await
}

pub async fn scan_and_pair_nintendo() -> Result<()> {
    handler::scan_and_pair_nintendo().await
}

// https://wiibrew.org/wiki/Wiimote#Bluetooth_Pairing
// The pin is the mac address with reversed pairs
pub fn mac_address_to_wii_pin(bluetooth_mac_address: String) -> Result<String> {
    if bluetooth_mac_address.len() != 12 {
        return Err(anyhow!(
            "Invalid Bluetooth Address: {}",
            bluetooth_mac_address
        ));
    }

    let mut bluetooth_pin = String::new();

    // Process address in reverse pairs
    for i in (0..bluetooth_mac_address.len()).rev().step_by(2) {
        if i < 1 {
            break;
        }
        let hex = &bluetooth_mac_address[i - 1..=i];

        let value = u8::from_str_radix(hex, 16).unwrap();
        bluetooth_pin.push(value as char);
    }

    Ok(bluetooth_pin)
}

// Given a bluetooth detailed view, check if the nintendo board exists.
pub fn find_nintendo_balance_board<'a>(
    bluetooth_view: &'a Vec<&'a BluetoothAdapterInfo>,
) -> Option<&'a BluetoothPeripheral> {
    for adapter in bluetooth_view {
        for device_result in &adapter.devices {
            if let Ok(device) = device_result {
                if device.name == NINTENDO_BOARD_ID {
                    return Some(device);
                }
            }
        }
    }
    None
}
