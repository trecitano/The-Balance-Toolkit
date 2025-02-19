// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use bluez_async::BluetoothSession;
mod test2;
use balance_toolkit_app_lib::address_to_wii_pin;

#[tokio::main]
async fn main() {
    print!("Let's go!");
    test().await;
    //   println!("{}", address_to_wii_pin().await.unwrap()); // Removed :s and fixed extra parenthesis
    //balance_toolkit_app_lib::run()
}

async fn test() {
    println!("Start");
    let (_, session) = BluetoothSession::new().await.unwrap();

    let adapters = session.get_adapters().await.unwrap();
    let first_adapter = adapters.first().unwrap();
    println!("Address is {:?}", first_adapter.mac_address);
}
