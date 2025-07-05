use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri::ipc::Channel;
use crate::file_system::{DeviceFileSystem, UserFileSystem};
use crate::types::{BalanceBoardEvent, NintendoDevice, User};
use tauri_plugin_fs::FsExt;
use tokio::sync::{Mutex, watch};
use crate::bluetooth::bluetooth_communication;
use crate::{balance_board_com, file_system};
use crate::balance_board_com::WiiBalanceBoard;

#[derive(Default)]
pub struct AppState {
    pub cancel_tx: Arc<Mutex<Option<watch::Sender<()>>>>,
    pub connected_devices: Arc<Mutex<Vec<WiiBalanceBoard>>>,
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // allowed the given directory
            let app_dir = file_system::app_dir();
            let scope = app.fs_scope();
            scope.allow_directory(app_dir, true)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            user_fetch_all,
            user_add,
            user_update,
            user_delete,
            devices_fetch_all,
            devices_scan_without_timeout,
            devices_cancel_scan,
            devices_connect
        ])
        .manage(AppState::default())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

struct FileMetadata {
    file_name: String,
    user: u64,
    last_updated: String,
    file_path: String,
}



// USERS

#[tauri::command]
fn user_fetch_all() -> Result<Vec<User>, String> {
    UserFileSystem::get_users().map_err(|e| e.to_string())
}

#[tauri::command]
fn user_add(user: User) -> Result<(), String> {
    UserFileSystem::add_user(user).map_err(|e| e.to_string())
}

#[tauri::command]
fn user_update(user: User) -> Result<(), String> {
    UserFileSystem::update_user(user).map_err(|e| e.to_string())
}

#[tauri::command]
fn user_delete(user_id: String) -> Result<(), String> {
    UserFileSystem::remove_user(user_id).map_err(|e| e.to_string())
}

// DEVICES

#[tauri::command(async)]
pub async fn devices_fetch_all() -> Result<Vec<NintendoDevice>, String> {
    let stored_devices = DeviceFileSystem::get_stored_devices().map_err(|e| e.to_string())?;
    let connected_devices: Vec<NintendoDevice> = tokio::task::spawn_blocking(move || {
        futures::executor::block_on(bluetooth_communication::get_nintendo_devices())
    }).await.unwrap().map_err(|e| e.to_string())?
        .into_iter()
        .map(|p| p.into())
        .collect();

    // First we add all stored devices to the result,
    let mut result: Vec<NintendoDevice> = Vec::new();
    for device in stored_devices {
        result.push(device);
    }

    // Then we upsert the connected devices
    for device in connected_devices {
        match result.iter_mut().find(|d| d.mac_address == device.mac_address) {
            Some(found) => found.last_connected = None,
            None => result.push(device)
        }
    }

    println!("Returning devices: #{:?}", result);

    Ok(result)
}

#[tauri::command(async)]
async fn devices_scan_without_timeout(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    println!("Scan START");
    let cancel_tx_lock = state.cancel_tx.lock().await.take();
        if cancel_tx_lock.is_some() {
        return Err("A scan is already in progress.".to_string());
    }

    let (cancel_tx, mut cancel_rx) = watch::channel(());
    *state.cancel_tx.lock().await = Some(cancel_tx);
    drop(cancel_tx_lock);

    println!("Scanning for devices...");
    loop {
        tokio::select! {
            _ = cancel_rx.changed() => {
                println!("Scan cancelled.");
                break;
            }
            new_board = bluetooth_communication::connect_new_balance_board() => {
                if let Ok(mac_address) = new_board {
                    match bluetooth_communication::get_nintendo_device_by_mac_address(mac_address).await {
                        Ok(device) => app.emit("new_board", NintendoDevice::from(device)).unwrap(),
                        Err(e) => (),
                    }
                }
            }
        }

        println!("Looping!");
    }

    let mut cancel_tx_lock = state.cancel_tx.lock().await;
    *cancel_tx_lock = None;
    println!("Exiting");
    Ok(())
}


#[tauri::command]
async fn devices_cancel_scan(state: State<'_, AppState>) -> Result<(), String> {
    if let Some(cancel_tx) = state.cancel_tx.lock().await.take() {
        let _ = cancel_tx.send(());
    }
    Ok(())
}

#[tauri::command(async)]
fn devices_connect(mac_address: String, channel: Channel<BalanceBoardEvent>) -> Result<(), String> {
    println!("Connecting to device: {}", mac_address);
    let transformed_address = mac_address.replace(":", "").trim().to_lowercase();
    balance_board_com::connect(transformed_address).map_err(|e| e.to_string())
}


/*
#[tauri::command]
pub async fn cancel_scan(state: State<'_, AppState>) -> Result<(), String> {
    let mut scan_state = state.scan_state.lock().await;

    if let Some(handle) = scan_state.handle.take() {
        println!("Cancelling scan...");
        handle.abort();
        println!("Scan cancelled.");
        Ok(())
    } else {
        Err("No scan is currently in progress.".to_string())
    }
}
*/

fn devices_remove(device_id: String) -> Result<(), String> {
    println!("Removing device: {}", device_id);
    Ok(())
}

