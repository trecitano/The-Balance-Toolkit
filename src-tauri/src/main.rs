

// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]


mod wii_pin_generator;

#[tokio::main]
async fn main() {
    let wii_pin = wii_pin_generator::generate().await.unwrap();
    println!("Pin is {}", wii_pin);
    //balance_toolkit_app_lib::run()
}