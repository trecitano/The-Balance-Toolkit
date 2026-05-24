// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod actors;
mod bluetooth;
mod file_system;
mod frontend;
mod processing;
mod types;
mod utils;

use crate::actors::toolkit_service::ConnectionManager;
use anyhow::Result;
use tokio::sync::mpsc;

pub static NINTENDO_BOARD_ID: &str = "Nintendo RVL-WBC-01";

#[tokio::main]
async fn main() -> Result<()> {
    #[cfg(target_os = "linux")]
    enforce_working_locale();

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

#[cfg(target_os = "linux")]
fn enforce_working_locale() {
    let lang = std::env::var("LANG").unwrap_or_default();
    if matches!(lang.as_str(), "" | "C" | "POSIX") {
        // Safety: called before GTK/WebView init; tokio worker threads don't read locale vars
        unsafe { std::env::set_var("LANG", "en_US.UTF-8") };
    }
}
