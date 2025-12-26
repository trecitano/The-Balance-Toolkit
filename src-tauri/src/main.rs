// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod actors;
mod bluetooth;
mod file_system;
mod types;
mod frontend;
mod processing;
mod utils;

use tokio::sync::mpsc;
use anyhow::Result;
use crate::actors::toolkit_service::ConnectionManager;

pub static NINTENDO_BOARD_ID: &str = "Nintendo RVL-WBC-01";

#[tokio::main]
async fn main() -> Result<()> {
    file_system::initialize_app_dir()?;

    // Startup: We initialize a single manager that holds all state, and runs in the background.
    // The architecture of the app is that the commandline or web/tauri send messages to this manager,
    // and the manager responds via a oneshot channel.
    let (manager_response_tx, manager_response_rx) = mpsc::channel(100);
    let manager = ConnectionManager::new(manager_response_tx)?;
    let manager_command_tx = manager.get_sender_channel();
    tokio::spawn(async move {
        if let Err(e) = manager.run().await {
            eprintln!("Error running connection manager: {}", e);
            panic!();
        }
    });
    
    frontend::tauri::initialize(manager_command_tx, manager_response_rx);
    Ok(())
}