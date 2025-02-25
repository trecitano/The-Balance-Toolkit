// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bluetooth;

use crate::bluetooth::bluetooth_communication;

#[tokio::main]
async fn main() {
    let all_bluetooth_view = bluetooth_communication::get_all_bluetooth_adapters_info().await.unwrap();
    let bluetooth_view = all_bluetooth_view.iter() // Borrow the original Vec
        .filter_map(|result| result.as_ref().ok()) // Extract references to Ok values
        .collect();

    eprintln!("Bluetooth view: {:#?}", all_bluetooth_view);

    let nintendo_board_opt = bluetooth_communication::find_nintendo_balance_board(&bluetooth_view);
    if let Some(nintendo_board) = nintendo_board_opt {
        if nintendo_board.connection_status == false {
            println!("Nintendo board is off. Please turn it on!");
        }
    } else {
        println!("Nintendo is not paired. Please turn on the sync.");
        bluetooth_communication::scan_and_pair_nintendo().await.unwrap()
    }

    //wii_pin_generator::all_adapter_bluetooth_connections().await;

    //balance_toolkit_app_lib::run()
}

fn check_hid() {
    let api = hidapi::HidApi::new().unwrap();
    // Print out information about all connected devices
    for device in api.device_list() {
        println!("{:?}", device);
        println!("{:?}", device.manufacturer_string());
        println!("{:?}", device.product_string());
    }

    let nintendo_device = api.device_list().find(|device| device.product_string().unwrap() == "Nintendo RVL-CNT-01").unwrap();
    let open = nintendo_device.open_device(&api).unwrap();

    let mut buf = vec![0; 100];

    println!("Reading data from device ...\n");

    loop {
        let len = open.read(&mut buf).unwrap();
        println!("{:?}", &buf[..len]);
    }
}

