#[cfg(target_os = "linux")]
use crate::bluetooth::linux_bluetooth_handler as handler;
use anyhow::{Result};
use serde::Serialize;
use crate::NINTENDO_BOARD_ID;
#[cfg(target_os = "windows")]
use crate::bluetooth::windows_bluetooth_handler as handler;

#[derive(Debug)]
enum BluetoothState {
    BluetoothError(String),
    BluetoothIsOff,
    NoAdaptersActive,
    BoardNotFound,
    BoardNotPaired,
    BoardNotConnected,
    BoardConnected,
}

#[derive(Debug)]
pub struct BluetoothAdapterInfo {
    pub id: String,
    pub name: String,
    pub mac_address: [u8; 6],
    pub is_active: bool,
    pub devices: Vec<Result<BluetoothPeripheral>>,
}

#[derive(Serialize, Debug)]
pub struct BluetoothPeripheral {
    pub id: String,
    pub name: String,
    pub mac_address: [u8; 6],
    pub is_paired: bool,
    pub is_connected: bool,
}


pub async fn get_nintendo_devices() -> Result<Vec<BluetoothPeripheral>> {
    let adapters: Vec<BluetoothAdapterInfo> = handler::get_all_bluetooth_adapters_info().await?
        .into_iter()
        .filter_map(|result| result.ok())
        .collect();

    let devices: Vec<BluetoothPeripheral> = adapters
        .into_iter()
        .flat_map(|adapter| adapter.devices.into_iter())
        .filter_map(|result| result.ok())
        .collect();
    
    let nintendo_devices = devices.into_iter()
        .filter(|device| device.name == NINTENDO_BOARD_ID).collect();

    Ok(nintendo_devices)
}

pub async fn ensure_balance_board_is_connected() {
    loop {
        println!("Checking...");
        let system_state = handler::get_all_bluetooth_adapters_info().await;
        println!("{:#?}", system_state);
        let enum_state = bluetooth_system_state(&system_state);
        match bluetooth_system_state(&system_state) {
            BluetoothState::BluetoothError(error) => {
                println!("{}", error);
            }
            BluetoothState::BluetoothIsOff => {
                println!("Please turn on the bluetooth.");
            }
            BluetoothState::NoAdaptersActive => {
                println!("Please turn on one bluetooth adapter.");
            }
            BluetoothState::BoardConnected => {
                return;
            }
            BluetoothState::BoardNotFound
            | BluetoothState::BoardNotPaired
            | BluetoothState::BoardNotConnected => {
                println!("{:?}", enum_state);
                let adapter: &BluetoothAdapterInfo = &system_state
                    .as_ref() // Borrow the Result
                    .unwrap() // Unwrap the outer Result
                    .first() // Get the first element
                    .unwrap() // Unwrap the Option
                    .as_ref() // Borrow the inner Result
                    .unwrap(); // Unwrap the inner Result

                handler::scan_and_pair_nintendo(&adapter).await.unwrap()
            }
        }

        // If the current state failed, wait one second before trying again
        println!("Ensuring board is connected, sleeping for 2 seconds.");
        tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;
    }
}

fn bluetooth_system_state(state: &Result<Vec<Result<BluetoothAdapterInfo>>>) -> BluetoothState {
    let all_bluetooth_view = match state {
        Ok(view) => view,
        Err(e) => {
            eprintln!("Failed to get Bluetooth adapters info: {:?}", e);
            return BluetoothState::BluetoothError(e.to_string());
        }
    };
    let bluetooth_view: Vec<&BluetoothAdapterInfo> = all_bluetooth_view
        .iter() // Borrow the original Vec
        .filter_map(|result| result.as_ref().ok())
        .collect();

    let nintendo_board_opt = find_nintendo_balance_board(&bluetooth_view);
    match nintendo_board_opt {
        Some(nintendo_board) => {
            if !nintendo_board.is_paired {
                BluetoothState::BoardNotPaired
            } else if !nintendo_board.is_connected {
                BluetoothState::BoardNotConnected
            } else {
                BluetoothState::BoardConnected
            }
        }
        None => BluetoothState::BoardNotFound,
    }
}

pub fn mac_address_to_wii_pin(mac_address: [u8; 6]) -> [u8; 6] {
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
