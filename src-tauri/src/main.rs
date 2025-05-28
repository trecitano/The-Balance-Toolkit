// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod balance_board_com;
mod bluetooth;

use crate::bluetooth::bluetooth_communication;

pub static NINTENDO_BOARD_ID: &str = "Nintendo RVL-WBC-01";
pub static HID_NINTENDO_BOARD_ID: &str = "Nintendo RVL-CNT-01";

#[tokio::main]
async fn main() {
    /*
    loop {
        bluetooth_communication::ensure_balance_board_is_connected().await;

        match balance_board_com::connect().await {
            Ok(_) => {}
            Err(e) => { println!("{}", e) }
        }
    }
    */
    balance_toolkit_app_lib::run()
}
