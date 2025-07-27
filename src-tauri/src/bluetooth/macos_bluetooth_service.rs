use anyhow::{anyhow, Result};
use std::process::Command;

use crate::actors::bluetooth_service::{BluetoothAdapterInfo};
use crate::types::MacAddress;


pub fn get_all_bluetooth_adapters_info() -> Result<Vec<Result<BluetoothAdapterInfo>>> {
    // This would be implemented by calling the external process
    Ok(vec![])
}
pub fn scan_and_pair_nintendo() {
    println!("Starting device scan...");

    let output = Command::new("cargo")
        .arg("run")
        .arg("--bin")
        .arg("bluetooth_process")
        .output()
        .expect("failed to execute process");

    println!("status: {}", output.status);
    println!("stdout: {}", String::from_utf8_lossy(&output.stdout));
    println!("stderr: {}", String::from_utf8_lossy(&output.stderr));
}

pub async fn remove_device(mac_address: MacAddress) -> Result<()> {
    // This would be implemented by calling the external process
    Err(anyhow!("Not implemented"))
}
