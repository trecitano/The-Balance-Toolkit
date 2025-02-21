mod commands;
mod wii_pin_generator;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![commands::get_all_bluetooth_adapters_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

