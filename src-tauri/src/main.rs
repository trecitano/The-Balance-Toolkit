// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod balance_board_com;
mod bluetooth;

use log::LevelFilter;
use crate::bluetooth::bluetooth_communication;

pub static NINTENDO_BOARD_ID: &str = "Nintendo RVL-WBC-01";

#[tokio::main]
async fn main() {
    //env_logger::Builder::new().filter_level(LevelFilter::Trace).init();
    bluetooth_communication::ensure_balance_board_is_connected().await;

    match balance_board_com::check_hid() {
            Ok(_) => {}
            Err(e) => { println!("{}", e) }
    }
}
