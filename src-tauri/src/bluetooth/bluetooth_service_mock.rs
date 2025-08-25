use std::string::ToString;
use std::sync::Mutex;
use std::time::Duration;
use anyhow::Result;
use async_trait::async_trait;
use once_cell::sync::Lazy;
use rand::Rng;
use crate::actors::bluetooth_service::{BluetoothAdapterInfo, BluetoothHandler, BluetoothPeripheral};
use crate::{utils, NINTENDO_BOARD_ID};
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
                mac_address: 0x0000_37FE_A12B_FDF4,
                is_paired: true,
                is_connected: true,
            }),
            Ok(BluetoothPeripheral {
                id: mock_device_id("Two".to_string()),
                name: NINTENDO_BOARD_ID.to_string(),
                mac_address: 0x0000_57C2_CBB2_7B49,
                is_paired: true,
                is_connected: false,
            }),
            Ok(BluetoothPeripheral {
                id: mock_device_id("Three".to_string()),
                name: NINTENDO_BOARD_ID.to_string(),
                mac_address: 0x0000_897E_4EE5_0DD3,
                is_paired: true,
                is_connected: false,
            }),
            Ok(BluetoothPeripheral {
                id: mock_device_id("Four".to_string()),
                name: NINTENDO_BOARD_ID.to_string(),
                mac_address: 0x0000_12E9_CDB9_7154,
                is_paired: true,
                is_connected: true,
            }),
            Ok(BluetoothPeripheral {
                id: mock_device_id("Five".to_string()),
                name: NINTENDO_BOARD_ID.to_string(),
                mac_address: 0x0000_F980_BD31_F8EC,
                is_paired: true,
                is_connected: true,
            }),
        ],
    }
}));

pub struct MockBluetoothHandler;
#[async_trait]
impl BluetoothHandler for MockBluetoothHandler {
    async fn get_all_bluetooth_adapters_info(&self) -> Result<Vec<Result<BluetoothAdapterInfo>>> {
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

    async fn scan_and_pair_nintendo(&self) -> Result<BluetoothPeripheral> {
        tokio::time::sleep(Duration::from_millis(800)).await;

        // Every X time, we assume that a new device was found.
        // We add this device to our global state, and return it.
        let mut mocked_data = MOCK_DATA.lock().unwrap();
        let mac_address = create_random_mac_address();
        let human_readable_mac_address = utils::mac_address_human_name(mac_address);

        let device_id = format!("Board {}", human_readable_mac_address);

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


    async fn remove_device(&self, mac_address: MacAddress) -> Result<()> {
        let mut mocked_data = MOCK_DATA.lock().unwrap();

        mocked_data.bluetooth_adapter_info.devices.retain(|device| {
            match device {
                Ok(d) => d.mac_address != mac_address,
                Err(_) => true
            }
        });

        Ok(())
    }
}

fn mock_device_id(device_id: String) -> String {
    format!("TBB_MOCKED_DEVICE_ID: {}", device_id)
}

fn create_random_mac_address() -> MacAddress {
    rand::rng().random::<u64>() & 0x0000_FFFF_FFFF_FFFF
}
