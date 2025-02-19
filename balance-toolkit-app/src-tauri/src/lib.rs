// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

use anyhow::{anyhow, Result};
use btleplug::api::Manager as _;
use btleplug::{api::Central, platform::Manager};
pub async fn address_to_wii_pin() -> Result<String> {
    // Get the Bluetooth adapter
    let manager = Manager::new().await?;
    let adapters = manager.adapters().await?;
    let adapter = adapters
        .first()
        .ok_or_else(|| anyhow!("no bluetooth adapter found"))?;

    let peris = adapter.peripherals().await?;

    for (index, adapter) in adapters.iter().enumerate() {
        // Get the adapter info string
        let adapter_info = adapter.adapter_info().await?;

        println!("\nAdapter {}:", index + 1);
        println!("Info: {}", adapter_info); // adapter_info is just a String
    }
    return Ok("wow".to_string());
    /*

        // Get the adapter's MAC address
        let bluetooth_address = adapter.address().to_string();

        if bluetooth_address.len() != 12 {
            return Err(anyhow!("Invalid Bluetooth Address: {}", bluetooth_address));
        }

        let mut bluetooth_pin = String::new();
        let mut double_zero_in_addr = false;

        // Process address in reverse pairs
        for i in (0..bluetooth_address.len()).rev().step_by(2) {
            if i < 1 {
                break;
            }
            let hex = &bluetooth_address[i-1..=i];

            if hex == "00" {
                double_zero_in_addr = true;
            }

            let value = u8::from_str_radix(hex, 16)?;
            bluetooth_pin.push(value as char);
        }

        if double_zero_in_addr {
            // Note: You'll need to implement double_zero_msg_box() equivalent
            // or handle this case differently in Rust
            return Ok("Invalid bt MAC address".to_string());
        }

        Ok(bluetooth_pin)
    */
}

