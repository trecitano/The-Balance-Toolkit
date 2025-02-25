
use crate::wii_pin_generator::{self, BluetoothAdapterInfo};

//#[tauri::command]
pub async fn get_all_bluetooth_adapters_info() -> Result<Vec<Result<BluetoothAdapterInfo, String>>,String> {
    match wii_pin_generator::get_all_bluetooth_adapters_info().await {
        Ok(vec) => {
            Ok(vec.into_iter()
            .map(|result| result.map_err(|e| e.to_string()))
            .collect())
        }
        Err(e) => { Err(e.to_string()) }
    }
}
