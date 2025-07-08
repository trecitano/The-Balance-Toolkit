#[cfg(target_os = "linux")]
use crate::bluetooth::linux_bluetooth_handler as handler;
use anyhow::{Result};
use serde::Serialize;
use crate::NINTENDO_BOARD_ID;
#[cfg(target_os = "windows")]
use crate::bluetooth::windows_bluetooth_handler as handler;
use crate::types::MacAddress;

#[derive(Debug)]
pub struct BluetoothAdapterInfo {
    pub id: String,
    pub name: String,
    pub mac_address: MacAddress,
    pub is_active: bool,
    pub devices: Vec<Result<BluetoothPeripheral>>,
}

#[derive(Serialize, Debug)]
pub struct BluetoothPeripheral {
    pub id: String,
    pub name: String,
    pub mac_address: MacAddress,
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

pub async fn get_nintendo_device_by_mac_address(mac_address: MacAddress) -> Result<BluetoothPeripheral> {
    get_nintendo_devices().await?
        .into_iter()
        .find(|device| device.mac_address == mac_address)
        .ok_or(anyhow::anyhow!("Nintendo balance board not found."))
}

pub async fn connect_new_balance_board() -> Result<MacAddress> {
    let connected_nintendo_devices = get_nintendo_devices().await?;
    println!("Current boards: #{:?}", connected_nintendo_devices);

    loop {
        let system_state = handler::get_all_bluetooth_adapters_info().await;
        let adapter = match system_state?.into_iter().find_map(Result::ok) {
            Some(adapter) => adapter,
            None => {
                println!("Bluetooth is off.");
                return Err(anyhow::anyhow!("Bluetooth is off."));
            }
        };

        let new_board_mac_address = match handler::scan_and_pair_nintendo(&adapter).await {
            Ok(mac_address) => mac_address,
            Err(e) => {
                println!("Failed to scan and pair nintendo balance board: {:?}", e);
                return Err(e);
            }
        };

        if connected_nintendo_devices.iter().find(|device| device.mac_address == new_board_mac_address).is_none() {
            return Ok(new_board_mac_address);
        }

        // If the current state failed, wait one second before trying again
        println!("Ensuring board is connected, sleeping for half a second.");
        tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;
    }
}

/*
pub fn turn_off_device(mac_address: MacAddress) -> Result<()> {
    handler::turn_off_device(mac_address)
}
*/

pub fn mac_address_to_wii_pin(mac_address: [u8; 6]) -> [u8; 6] {
    let mut pin = [0u8; 6];

    // Reverse the MAC address bytes
    for i in 0..6 {
        pin[i] = mac_address[5 - i];
    }

    pin
}
