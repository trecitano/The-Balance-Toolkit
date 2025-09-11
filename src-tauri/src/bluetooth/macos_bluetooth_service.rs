use anyhow::{anyhow, Context, Result};
use async_trait::async_trait;
use tokio::sync::mpsc;
use tokio::time::{timeout, Duration};
use tokio::process::Command as TokioCommand;

use crate::actors::bluetooth_service::{
    BluetoothAdapterInfo, BluetoothHandler, BluetoothPeripheral,
};
use crate::types::MacAddress;

#[derive(Debug, serde::Deserialize)]
struct PeripheralOut {
    id: String,
    name: String,
    mac_address: u64,
    is_paired: bool,
    is_connected: bool,
}



pub struct NativeBluetoothHandler;
#[async_trait]
impl BluetoothHandler for NativeBluetoothHandler {
    async fn get_all_bluetooth_adapters_info(
        &self,
    ) -> Result<Vec<Result<BluetoothAdapterInfo>>> {
        // system-view returns JSON array
        let mut cmd = TokioCommand::new(&BINARY_PATH);
        cmd.arg("system-view");
        let output = timeout(Duration::from_secs(5), cmd.output())
            .await
            .map_err(|_| anyhow!("system-view timed out"))??;

        if !output.status.success() {
            return Err(anyhow!(
                "system-view failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        let stdout = String::from_utf8(output.stdout)
            .context("system-view stdout not UTF-8")?;
        let devices: Vec<PeripheralOut> =
            serde_json::from_str(&stdout).context("failed to parse system-view JSON")?;

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
        // scan-and-pair prints a single PeripheralOut as JSON on success
        let mut cmd = TokioCommand::new(&BINARY_PATH);
        cmd.arg("scan-and-pair");
        let output = timeout(Duration::from_secs(120), cmd.output())
            .await
            .map_err(|_| anyhow!("scan-and-pair timed out"))??;

        if !output.status.success() {
            return Err(anyhow!(
                "scan-and-pair failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        let stdout = String::from_utf8(output.stdout)
            .context("scan-and-pair stdout not UTF-8")?;
        let dev: PeripheralOut =
            serde_json::from_str(&stdout).context("failed to parse device JSON")?;

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
        let mut cmd = TokioCommand::new(&BINARY_PATH);
        cmd.arg("remove").arg(&mac_str);

        let status = timeout(Duration::from_secs(15), cmd.status())
            .await
            .map_err(|_| anyhow!("remove timed out"))??;

        if !status.success() {
            return Err(anyhow!("remove failed with status {:?}", status));
        }
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