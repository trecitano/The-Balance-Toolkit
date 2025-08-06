use std::sync::Mutex;
use std::time::Duration;
use anyhow::Result;
use once_cell::sync::Lazy;
use rand::Rng;
use crate::actors::bluetooth_service::{BluetoothAdapterInfo, BluetoothPeripheral};
use crate::NINTENDO_BOARD_ID;
use crate::types::MacAddress;

struct MockedData {
    bluetooth_adapter_info: BluetoothAdapterInfo,
}

static MOCK_DATA: Lazy<Mutex<MockedData>> = Lazy::new(|| Mutex::new(MockedData {
    bluetooth_adapter_info: BluetoothAdapterInfo {
        id: "One".to_string(),
        name: NINTENDO_BOARD_ID.to_string(),
        mac_address: create_random_mac_address(),
        is_active: true,
        devices: vec![
            Ok(BluetoothPeripheral {
                id: "One".to_string(),
                name: NINTENDO_BOARD_ID.to_string(),
                mac_address: create_random_mac_address(),
                is_paired: true,
                is_connected: true,
            }),
            Ok(BluetoothPeripheral {
                id: "Two".to_string(),
                name: NINTENDO_BOARD_ID.to_string(),
                mac_address: create_random_mac_address(),
                is_paired: true,
                is_connected: false,
            }),
            Ok(BluetoothPeripheral {
                id: "Three".to_string(),
                name: NINTENDO_BOARD_ID.to_string(),
                mac_address: create_random_mac_address(),
                is_paired: true,
                is_connected: false,
            }),
            Ok(BluetoothPeripheral {
                id: "Four".to_string(),
                name: NINTENDO_BOARD_ID.to_string(),
                mac_address: create_random_mac_address(),
                is_paired: true,
                is_connected: true,
            }),
            Ok(BluetoothPeripheral {
                id: "Five".to_string(),
                name: NINTENDO_BOARD_ID.to_string(),
                mac_address: create_random_mac_address(),
                is_paired: true,
                is_connected: true,
            }),
        ],
    }
}));

pub async fn get_all_bluetooth_adapters_info() -> Result<Vec<Result<BluetoothAdapterInfo>>> {
    let mocked_data = MOCK_DATA.lock().unwrap();

    // Copy the current global state
    Ok(
        vec![
            Ok(
                BluetoothAdapterInfo {
                    id: mocked_data.bluetooth_adapter_info.id.clone(),
                    name: mocked_data.bluetooth_adapter_info.name.clone(),
                    mac_address: mocked_data.bluetooth_adapter_info.mac_address,
                    is_active: true,
                    devices: mocked_data.bluetooth_adapter_info.devices
                        .iter()
                        .filter_map(|device| {
                            match device {
                                Ok(p) => Some(Ok(p.clone())),
                                Err(_) => panic!()
                            }
                        }).collect(),
                }
            )
        ]
    )
}


pub async fn scan_and_pair_nintendo() -> Result<BluetoothPeripheral> {
    tokio::time::sleep(Duration::from_millis(800)).await;

    // Every X time, we assume that a new device was found.
    // We add this device to our global state, and return it.
    let mut mocked_data = MOCK_DATA.lock().unwrap();
    let number_devices = mocked_data.bluetooth_adapter_info.devices.len();
    let device_id = format!("Board {}", number_devices);
    
    let new_device = BluetoothPeripheral { 
        id: device_id,
        name: NINTENDO_BOARD_ID.to_string(),
        mac_address: create_random_mac_address(),
        is_paired: true,
        is_connected: true,
    };

    mocked_data.bluetooth_adapter_info.devices.push(Ok(new_device.clone()));
    
    Ok(new_device)
}

pub async fn remove_device(device_id: String) -> Result<()> {
    let mut mocked_data = MOCK_DATA.lock().unwrap();
    println!("Removing device {}", device_id);
    
    mocked_data.bluetooth_adapter_info.devices.retain(|device| {
        match device {
            Ok(d) => d.id != device_id,
            Err(_) => true
        }
    });
    
    Ok(())
}

fn create_random_mac_address() -> MacAddress {
    let mut bytes = [0u8; 6];
    rand::rng().fill(&mut bytes);
    bytes
}
