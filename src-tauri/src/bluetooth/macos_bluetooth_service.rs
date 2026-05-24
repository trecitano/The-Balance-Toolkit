use anyhow::{Context, Result, anyhow};
use async_trait::async_trait;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::mpsc;

use crate::actors::bluetooth_service::{
    BluetoothAdapterInfo, BluetoothHandler, BluetoothPeripheral,
};
use crate::bluetooth::macos_io_bluetooth;
use crate::types::MacAddress;

pub struct NativeBluetoothHandler;

/// Signals the dedicated IOBluetooth scan thread to abort. Dropped when the
/// `scan_and_pair_nintendo` future is dropped (i.e. the Bluetooth actor
/// cancelled the scan), which is our only chance to run teardown since future
/// cancellation gives us no async drop.
struct StopOnDrop(Arc<AtomicBool>);

impl Drop for StopOnDrop {
    fn drop(&mut self) {
        self.0.store(true, Ordering::SeqCst);
    }
}

#[async_trait]
impl BluetoothHandler for NativeBluetoothHandler {
    async fn get_all_bluetooth_adapters_info(&self) -> Result<Vec<Result<BluetoothAdapterInfo>>> {
        let devices =
            tokio::task::spawn_blocking(macos_io_bluetooth::collect_connected_devices)
                .await
                .context("collect_connected_devices thread panicked")?;

        let peripherals: Vec<Result<BluetoothPeripheral>> = devices
            .into_iter()
            .map(|d| {
                Ok(BluetoothPeripheral {
                    id: d.id,
                    name: d.name,
                    mac_address: d.mac_address,
                    is_paired: d.is_paired,
                    is_connected: d.is_connected,
                })
            })
            .collect();

        Ok(vec![Ok(BluetoothAdapterInfo {
            id: "macos-io-bluetooth".to_string(),
            name: "IOBluetooth".to_string(),
            mac_address: 0,
            is_active: true,
            devices: peripherals,
        })])
    }

    async fn scan_and_pair_nintendo(
        &self,
        response_stream: mpsc::Sender<BluetoothPeripheral>,
    ) -> Result<()> {
        let stop = Arc::new(AtomicBool::new(false));
        // Held across the await: if the future is cancelled, this drops and
        // signals the scan thread to stop the inquiry and exit.
        let _guard = StopOnDrop(stop.clone());
        let stop_thread = stop.clone();

        let (tx, rx) =
            std::sync::mpsc::channel::<Result<macos_io_bluetooth::PeripheralOut, String>>();

        std::thread::Builder::new()
            .name("wii-io-bluetooth-scan".into())
            .spawn(move || {
                let res = macos_io_bluetooth::scan_and_pair_blocking(stop_thread);
                let _ = tx.send(res);
            })
            .context("failed to spawn IOBluetooth scan thread")?;

        // Wait for the dedicated thread's result without blocking a tokio
        // worker. `spawn_blocking` runs to completion even if this future is
        // cancelled, so `rx.recv()` resolves once the thread reacts to `stop`.
        let recv_result = tokio::task::spawn_blocking(move || rx.recv())
            .await
            .context("scan result join failed")?;

        let dev = match recv_result {
            Ok(Ok(dev)) => dev,
            Ok(Err(e)) => return Err(anyhow!("scan-and-pair failed: {e}")),
            Err(_) => return Ok(()), // thread ended without a result
        };

        let peripheral = BluetoothPeripheral {
            id: dev.id,
            name: dev.name,
            mac_address: dev.mac_address,
            is_paired: dev.is_paired,
            is_connected: dev.is_connected,
        };

        let _ = response_stream.send(peripheral).await;
        Ok(())
    }

    async fn remove_device(&self, mac_address: MacAddress) -> Result<()> {
        let mac_str = mac_u64_to_colon(mac_address);

        tokio::task::spawn_blocking(move || macos_io_bluetooth::remove_device_by_mac(&mac_str))
            .await
            .context("remove_device thread panicked")?
            .map_err(|e| anyhow!("remove failed: {e}"))?;

        Ok(())
    }
}

fn mac_u64_to_colon(mac: u64) -> String {
    let b0 = ((mac >> 40) & 0xff) as u8;
    let b1 = ((mac >> 32) & 0xff) as u8;
    let b2 = ((mac >> 24) & 0xff) as u8;
    let b3 = ((mac >> 16) & 0xff) as u8;
    let b4 = ((mac >> 8) & 0xff) as u8;
    let b5 = (mac & 0xff) as u8;
    format!(
        "{:02X}:{:02X}:{:02X}:{:02X}:{:02X}:{:02X}",
        b0, b1, b2, b3, b4, b5
    )
}
