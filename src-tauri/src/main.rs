// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod actors;
mod bluetooth;
mod file_system;
mod types;
mod frontend;

use tokio::sync::mpsc;
use crate::actors::bluetooth_service::BluetoothCommand;
use crate::actors::toolkit_service::{ConnectionManager, ToolkitCommand};

pub static NINTENDO_BOARD_ID: &str = "Nintendo RVL-WBC-01";

#[tokio::main]
async fn main() {
    // Startup: We initialize a single manager that holds all of the state, and runs in the background.
    // The architecture of the app is that the commandline or web/tauri send messages to this manager,
    // and the manager responds via a oneshot channel.
    let (manager_tx, manager_rx) = mpsc::channel(100);
    let manager = ConnectionManager::new(manager_tx.clone(), manager_rx);
    tokio::spawn(async move {
        manager.run().await;
    });
    
    file_system::initialize_app_dir().unwrap();

    let (new_bluetooth_tx, mut new_bluetooth_rx) = mpsc::channel(10);
    let command = ToolkitCommand::BluetoothAction {
        action: BluetoothCommand::StartScanAndPair {
            response_stream: new_bluetooth_tx
        }
    };
    manager_tx.send(command).await.map_err(|e| e.to_string()).unwrap();
    tokio::time::sleep(tokio::time::Duration::from_millis(10000)).await;
    
    //tauri_frontend::initialize(manager_tx)
}