// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bluetooth;
mod balance_board_com;

use crate::bluetooth::bluetooth_communication;

#[tokio::main]
async fn main() {
    let all_bluetooth_view = bluetooth_communication::get_all_bluetooth_adapters_info()
        .await
        .unwrap();
    let bluetooth_view = all_bluetooth_view
        .iter() // Borrow the original Vec
        .filter_map(|result| result.as_ref().ok())
        .collect();

    println!("Bluetooth view: {:#?}", all_bluetooth_view);

    let nintendo_board_opt = bluetooth_communication::find_nintendo_balance_board(&bluetooth_view);
    if let Some(nintendo_board) = nintendo_board_opt {
        if nintendo_board.connection_status == false {
            println!("Nintendo board is off. Please turn it on!");
        }
    } else {
        println!("Nintendo is not paired. Please turn on the sync.");
        bluetooth_communication::scan_and_pair_nintendo()
            .await
            .unwrap()
    }

    balance_board_com::check_hid().unwrap();
}