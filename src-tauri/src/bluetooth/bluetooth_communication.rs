use anyhow::{Result, anyhow};
use crate::bluetooth::bluetooth_communication;
#[cfg(target_os = "linux")]
use crate::bluetooth::linux_bluetooth_handler as handler;

#[cfg(target_os = "windows")]
use crate::bluetooth::windows_bluetooth_handler as handler;

enum BluetoothState {
    BluetoothIsOff,
    NoAdaptersActive,
    BoardFoundButOff,
    BoardNotFound,
    BoardFoundAndOn
}

#[derive(Debug)]
pub struct BluetoothAdapterInfo {
    pub id: String,
    pub name: String,
    pub mac_address: [u8; 6],
    pub wii_board_pin: [u8; 6],
    pub is_active: bool,
    pub devices: Vec<Result<BluetoothPeripheral>>,
}

#[derive(Debug)]
pub struct BluetoothPeripheral {
    pub id: String,
    pub name: String,
    pub bluetooth_address: [u8; 6],
    pub connection_status: bool,
}

pub static NINTENDO_BOARD_ID: &str = "Nintendo RVL-WBC-01";

pub async fn ensure_balance_board_is_connected() {
    let all_bluetooth_view = handler::get_all_bluetooth_adapters_info()
        .await
        .unwrap();
    let bluetooth_view: Vec<&BluetoothAdapterInfo> = all_bluetooth_view
        .iter() // Borrow the original Vec
        .filter_map(|result| result.as_ref().ok())
        .collect();

    println!("Bluetooth view: {:#?}", all_bluetooth_view);

    let adapter: &BluetoothAdapterInfo = &bluetooth_view.first().unwrap();
    // Process address in reverse pairs
    let mut bluetooth_pin = String::new();
    for byte in adapter.wii_board_pin {
        bluetooth_pin.push(byte as char);
    }

    let nintendo_board_opt = find_nintendo_balance_board(&bluetooth_view);
    if let Some(nintendo_board) = nintendo_board_opt {
        if nintendo_board.connection_status == false {
            println!("Nintendo board is off. Please turn it on!");
        }
    } else {
        println!("Nintendo is not paired. Please turn on the sync.");
        handler::scan_and_pair_nintendo(bluetooth_view.first().unwrap())
            .await
            .unwrap()
    }
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


pub fn better_mac_address_to_wii_pin(mac_address: [u8; 6]) -> [u8; 6] {
    let mut pin = [0u8; 6];

    // Reverse the MAC address bytes
    for i in 0..6 {
        pin[i] = mac_address[5 - i];
    }

    pin
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
