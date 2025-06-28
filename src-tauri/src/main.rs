// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod balance_board_com;
mod bluetooth;
mod file_system;
mod types;
mod tauri_setup;

pub static NINTENDO_BOARD_ID: &str = "Nintendo RVL-WBC-01";
pub static HID_NINTENDO_BOARD_ID: &str = "Nintendo RVL-CNT-01";

use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::task::AbortHandle;

#[derive(Default)]
pub struct ScanState {
    pub handle: Option<AbortHandle>,
}

pub struct AppState {
    pub scan_state: Arc<Mutex<ScanState>>,
}

#[tokio::main]
async fn main() {
    file_system::initialize_app_dir();
    /*
    loop {
        let connected_balance_boards = bluetooth_communication::get_connected_balance_boards().await;

        if connected_balance_boards.is_empty() {
            bluetooth_communication::connect_to_new_balance_board(&connected_balance_boards).await;
        }

        println!("The following balance boards are connected:");
        for (idx, board) in connected_balance_boards.iter().enumerate() {
            println!("Board {}: MAC ({}), name: {}", idx + 1, board.mac_address, board.name);
        }

        println!("Should we start capturing the inputs (1), or wait for more boards? (2)");
        let mut input = String::new();
        std::io::stdin().read_line(&mut input).unwrap();

        if input == "2" {
            match balance_board_com::connect().await {
                Ok(_) => {}
                Err(e) => { println!("{}", e) }
            };
        } else {
            bluetooth_communication::connect_to_new_balance_board(connected_balance_boards)
        }
    }
    */
    tauri_setup::run()
}
