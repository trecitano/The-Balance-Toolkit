use std::string::ToString;
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
                id: mock_device_id("One".to_string()),
                name: NINTENDO_BOARD_ID.to_string(),
                mac_address: [0x37, 0xfe, 0xa1, 0x2b, 0xfd, 0xf4],
                is_paired: true,
                is_connected: true,
            }),
            Ok(BluetoothPeripheral {
                id: mock_device_id("Two".to_string()),
                name: NINTENDO_BOARD_ID.to_string(),
                mac_address: [0x57, 0xc2, 0xcb, 0xb2, 0x7b, 0x49],
                is_paired: true,
                is_connected: false,
            }),
            Ok(BluetoothPeripheral {
                id: mock_device_id("Three".to_string()),
                name: NINTENDO_BOARD_ID.to_string(),
                mac_address: [0x89, 0x7e, 0x4e, 0xe5, 0x0d, 0xd3],
                is_paired: true,
                is_connected: false,
            }),
            Ok(BluetoothPeripheral {
                id: mock_device_id("Four".to_string()),
                name: NINTENDO_BOARD_ID.to_string(),
                mac_address: [0x12, 0xe9, 0xcd, 0xb9, 0x71, 0x54],
                is_paired: true,
                is_connected: true,
            }),
            Ok(BluetoothPeripheral {
                id: mock_device_id("Five".to_string()),
                name: NINTENDO_BOARD_ID.to_string(),
                mac_address: [0xf9, 0x80, 0xbd, 0x31, 0xf8, 0xec],
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
        id: mock_device_id(device_id),
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

fn mock_device_id(device_id: String) -> String {
    format!("TBB_MOCKED_DEVICE_ID: {}", device_id)
}

fn create_random_mac_address() -> MacAddress {
    let mut bytes = [0u8; 6];
    rand::rng().fill(&mut bytes);
    bytes
}
