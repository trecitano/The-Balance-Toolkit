#[cfg(target_os = "linux")]
use crate::bluetooth::linux_bluetooth_service::Handler;
#[cfg(target_os = "windows")]
use crate::bluetooth::windows_bluetooth_service::Handler;
#[cfg(target_os = "macos")]
use crate::bluetooth::macos_bluetooth_service as NativeHandler;

use anyhow::{Result};
use serde::Serialize;
use tokio::sync::{mpsc, oneshot};
use crate::NINTENDO_BOARD_ID;
use crate::types::{MacAddress, NintendoDevice};

#[derive(Debug)]
pub enum BluetoothCommand {
    GetNintendoDevices { response: oneshot::Sender<Vec<BluetoothPeripheral>>},
    StartScanAndPair { response_stream: mpsc::Sender<BluetoothPeripheral> },
    StopScan,
    IsScanning { response: oneshot::Sender<bool>},
    RemoveDevice { mac_address: MacAddress },
}

// The bluetooth implementations should contain the following functions:
//
// get_all_bluetooth_adapters_info
// scan_and_pair_nintendo
// remove_device

pub enum NativeBluetoothCommand {
    GetAllBluetoothAdaptersInfo { response: oneshot::Sender<Result<Vec<Result<BluetoothAdapterInfo>>>> },
    ScanAndPairDevice { device_name: String, response: oneshot::Sender<Result<BluetoothPeripheral>> },
    RemoveDevice { mac_address: MacAddress, response: oneshot::Sender<Result<()>> },
}


pub struct BluetoothHandler {
    bluetooth_rx: mpsc::Receiver<BluetoothCommand>,
    scan_cancel_tx: Option<oneshot::Sender<()>>,
}

impl BluetoothHandler {
    pub fn start_bluetooth_handler() -> mpsc::Sender<BluetoothCommand> {
        let (bluetooth_tx, bluetooth_rx) = mpsc::channel(100);

        let handler = BluetoothHandler {
            bluetooth_rx,
            scan_cancel_tx: None,
        };

        tokio::spawn(async move {
            handler.run().await;
        });

        bluetooth_tx
    }

    pub async fn run(mut self) {
        println!("Bluetooth Manager started.");

        while let Some(command) = self.bluetooth_rx.recv().await {
            match command {
                BluetoothCommand::GetNintendoDevices { response } => {
                    let result = Self::get_nintendo_devices().await.unwrap();
                    response.send(result).unwrap();
                },
                BluetoothCommand::StartScanAndPair { response_stream } => {
                    self.start_scan(response_stream).await.unwrap();
                },
                BluetoothCommand::StopScan => {
                    self.scan_cancel_tx = None;
                },
                BluetoothCommand::IsScanning { response } => {
                    response.send(self.scan_cancel_tx.is_some()).unwrap();
                }
                BluetoothCommand::RemoveDevice { mac_address } => {
                    NativeHandler::remove_device(mac_address).await.unwrap();
                }
            }
        }

        println!("Bluetooth Manager stopped.");
    }

    async fn start_scan(&mut self, response_stream: mpsc::Sender<BluetoothPeripheral>) -> Result<()> {
        if self.scan_cancel_tx.is_some() {
            println!("Scan is already in progress.");
            return Ok(());
        }

        let (cancel_tx, mut cancel_rx) = oneshot::channel();
        self.scan_cancel_tx = Some(cancel_tx);

        let native_tx_clone = self.inner_tx.clone();
        tokio::spawn(async move {
            println!("Scanning for devices in background...");
            loop {
                tokio::select! {
                    _ = &mut cancel_rx => {
                        println!("Scan cancelled.");
                        break;
                    }

                    _ = Self::connect_new_balance_board(native_tx_clone.clone(), response_stream.clone()) => {
                        // If the current state failed, wait one second before trying again
                        // TODO update this value
                        tokio::time::sleep(tokio::time::Duration::from_millis(50000)).await;
                    },
                }
            }

            println!("Exiting background scan task.");
        });

        Ok(())
    }

    async fn get_nintendo_devices() -> Result<Vec<BluetoothPeripheral>> {
        let adapters: Vec<BluetoothAdapterInfo> = NativeHandler::get_all_bluetooth_adapters_info()?
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

    async fn connect_new_balance_board(native_bluetooth_tx: mpsc::Sender<NativeBluetoothCommand>, response_stream: mpsc::Sender<BluetoothPeripheral>) -> Result<()> {
        let connected_nintendo_devices = Self::get_nintendo_devices(&native_bluetooth_tx).await?;
        println!("Current boards: #{:?}", connected_nintendo_devices);

        let bluetooth_device = match Self::scan_and_pair_nintendo(&native_bluetooth_tx).await {
            Ok(bluetooth_device) => bluetooth_device,
            Err(e) => {
                println!("Failed to scan and pair nintendo balance board: {:?}", e);
                return Err(e);
            }
        };

        if connected_nintendo_devices.iter().find(|device| device.mac_address == bluetooth_device.mac_address).is_none() {
            response_stream.send(bluetooth_device).await?
        }

        Ok(())
    }

    // Calls to Native Bluetooth primitives

    async fn scan_and_pair_nintendo(native_bluetooth_tx: &mpsc::Sender<NativeBluetoothCommand>) -> Result<BluetoothPeripheral> {
        let (tx, rx) = oneshot::channel();
        let command = NativeBluetoothCommand::ScanAndPairDevice { device_name: NINTENDO_BOARD_ID.to_string(), response: tx };
        native_bluetooth_tx.send(command).await?;
        rx.await?
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

impl From<BluetoothPeripheral> for NintendoDevice {
    fn from(p: BluetoothPeripheral) -> Self {
        let mac_str = p.mac_address
            .iter()
            .map(|b| format!("{:02x}", b))
            .collect::<Vec<String>>()
            .join(":");

        let pin_array = mac_address_to_wii_pin(p.mac_address);
        let pin_hex_str = pin_array
            .iter()
            .map(|b| format!("{:02X}", b))
            .collect::<Vec<String>>()
            .join("");

        NintendoDevice {
            name: p.name,
            status: "Active".to_string(),
            mac_address: mac_str,
            pin: pin_hex_str.clone(),
            last_connected: None,
        }
    }
}