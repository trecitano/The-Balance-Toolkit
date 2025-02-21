

// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]


mod wii_pin_generator;

#[tokio::main]
async fn main() {
    println!("Pins are {:?}", wii_pin_generator::get_all_bluetooth_adapters_info().await);
    //balance_toolkit_app_lib::run()
}