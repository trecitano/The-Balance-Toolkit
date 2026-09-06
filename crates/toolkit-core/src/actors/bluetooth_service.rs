use crate::bluetooth::bluetooth_service_mock::MockBluetoothHandler;
#[cfg(target_os = "linux")]
use crate::bluetooth::linux_bluetooth_service::NativeBluetoothHandler;
#[cfg(target_os = "macos")]
use crate::bluetooth::macos_bluetooth_service::NativeBluetoothHandler;
#[cfg(target_os = "windows")]
use crate::bluetooth::windows_bluetooth_service::NativeBluetoothHandler;
use std::sync::Arc;

use crate::NINTENDO_BOARD_ID;
use crate::types::{MacAddress, NintendoDevice};
use anyhow::Result;
use async_trait::async_trait;
use chrono::Utc;
use serde::Serialize;
use tokio::sync::{mpsc, oneshot};

#[derive(Debug)]
pub enum BluetoothCommand {
    GetNintendoDevices {
        response: oneshot::Sender<Result<Vec<BluetoothPeripheral>>>,
    },
    StartScanAndPair {
        response_stream: mpsc::Sender<BluetoothPeripheral>,
        response: oneshot::Sender<()>,
    },
    StopScan {
        response: oneshot::Sender<()>,
    },
    IsScanning {
        response: oneshot::Sender<bool>,
    },
    RemoveDevice {
        mac_address: MacAddress,
    },
}

#[async_trait]
pub trait BluetoothHandler: Send + Sync {
    async fn get_all_bluetooth_adapters_info(&self) -> Result<Vec<Result<BluetoothAdapterInfo>>>;
    async fn scan_and_pair_nintendo(
        &self,
        response_stream: mpsc::Sender<BluetoothPeripheral>,
    ) -> Result<()>;
    async fn remove_device(&self, mac_address: MacAddress) -> Result<()>;
}

pub struct BluetoothService {
    bluetooth_rx: mpsc::Receiver<BluetoothCommand>,
    bluetooth_implementation: Arc<dyn BluetoothHandler>,
    scan_cancel_tx: Option<oneshot::Sender<()>>,
}

impl BluetoothService {
    pub fn start_bluetooth_handler(is_demo_mode: bool) -> mpsc::Sender<BluetoothCommand> {
        let (bluetooth_tx, bluetooth_rx) = mpsc::channel(100);

        let handler = BluetoothService {
            bluetooth_rx,
            bluetooth_implementation: Self::create_bluetooth_handler(is_demo_mode),
            scan_cancel_tx: None,
        };

        tokio::spawn(async move {
            handler.run().await;
        });

        bluetooth_tx
    }

    pub async fn run(mut self) {
        log::debug!("Bluetooth Manager started.");

        while let Some(command) = self.bluetooth_rx.recv().await {
            match command {
                BluetoothCommand::GetNintendoDevices { response } => {
                    // Errors are handed back to the caller rather than turned into an empty
                    // list: an empty list would read as "every board disconnected".
                    let result = Self::get_nintendo_devices(&self.bluetooth_implementation).await;
                    let _ = response.send(result);
                }
                BluetoothCommand::StartScanAndPair {
                    response_stream,
                    response,
                } => {
                    if let Err(e) = self.start_scan(response_stream).await {
                        log::error!("Failed to start Bluetooth scan: {e:#}");
                    }
                    let _ = response.send(());
                }
                BluetoothCommand::StopScan { response } => {
                    self.scan_cancel_tx = None;
                    let _ = response.send(());
                }
                BluetoothCommand::IsScanning { response } => {
                    let _ = response.send(self.scan_cancel_tx.is_some());
                }
                BluetoothCommand::RemoveDevice { mac_address } => {
                    if let Err(e) = self
                        .bluetooth_implementation
                        .remove_device(mac_address)
                        .await
                    {
                        log::warn!("remove_device failed for {}: {}", mac_address, e);
                    }
                }
            }
        }

        log::debug!("Bluetooth Manager stopped.");
    }

    fn create_bluetooth_handler(is_demo_mode: bool) -> Arc<dyn BluetoothHandler> {
        if is_demo_mode {
            log::debug!("Starting Mock Bluetooth handler.");
            Arc::new(MockBluetoothHandler {})
        } else {
            log::debug!("Starting Native Bluetooth handler.");
            Arc::new(NativeBluetoothHandler::default())
        }
    }

    async fn start_scan(
        &mut self,
        response_stream: mpsc::Sender<BluetoothPeripheral>,
    ) -> Result<()> {
        if self.scan_cancel_tx.is_some() {
            log::debug!("Scan is already in progress.");
            return Ok(());
        }

        let (cancel_tx, mut cancel_rx) = oneshot::channel();
        self.scan_cancel_tx = Some(cancel_tx);
        let bluetooth_handler = self.bluetooth_implementation.clone();

        tokio::spawn(async move {
            log::info!("Scanning for devices in background...");
            loop {
                tokio::select! {
                    _ = &mut cancel_rx => {
                        log::info!("Scan cancelled.");
                        break;
                    }

                    result = bluetooth_handler.scan_and_pair_nintendo(response_stream.clone()) => {
                        if let Err(e) = result {
                            log::error!("scan_and_pair_nintendo failed: {e:#}");
                        }
                        tokio::time::sleep(tokio::time::Duration::from_millis(1500)).await;
                    }
                }
            }

            log::debug!("Exiting background scan task.");
        });

        Ok(())
    }

    pub async fn get_nintendo_devices(
        bluetooth_handler: &Arc<dyn BluetoothHandler>,
    ) -> Result<Vec<BluetoothPeripheral>> {
        let adapter_info = bluetooth_handler.get_all_bluetooth_adapters_info().await?;
        BluetoothService::filter_nintendo_devices(Ok(adapter_info)).await
    }

    pub async fn filter_nintendo_devices(
        bluetooth_adapter_info: Result<Vec<Result<BluetoothAdapterInfo>>>,
    ) -> Result<Vec<BluetoothPeripheral>> {
        let adapters: Vec<BluetoothAdapterInfo> = bluetooth_adapter_info?
            .into_iter()
            .filter_map(|result| result.ok())
            .collect();

        let devices: Vec<BluetoothPeripheral> = adapters
            .into_iter()
            .flat_map(|adapter| adapter.devices.into_iter())
            .filter_map(|result| result.ok())
            .collect();

        let nintendo_devices = devices
            .into_iter()
            .filter(|device| device.name == NINTENDO_BOARD_ID)
            .collect();

        Ok(nintendo_devices)
    }
}

/// The Wii pairing PIN is the adapter's MAC address in reverse byte order. Only the Windows
/// pairing flow needs it; the other platforms pair through the OS Bluetooth stack.
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
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
    /// Reported by every platform for diagnostics; not consulted when filtering devices.
    #[allow(dead_code)]
    pub is_active: bool,
    pub devices: Vec<Result<BluetoothPeripheral>>,
}

#[derive(Serialize, Debug, Clone)]
pub struct BluetoothPeripheral {
    pub id: String,
    pub name: String,
    pub mac_address: MacAddress,
    pub is_paired: bool,
    pub is_connected: bool,
}

impl From<BluetoothPeripheral> for NintendoDevice {
    fn from(p: BluetoothPeripheral) -> Self {
        NintendoDevice {
            id: p.id,
            name: p.name,
            mac_address: p.mac_address,
            is_connected: p.is_connected,
            last_connected: if p.is_connected {
                Some(Utc::now())
            } else {
                None
            },
        }
    }
}
