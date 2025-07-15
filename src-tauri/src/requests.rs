use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tauri::ipc::Channel;
use crate::file_system::{DeviceFileSystem, UserFileSystem};
use crate::types::{BalanceBoardEvent, MacAddress, NintendoDevice, User};
use tauri_plugin_fs::FsExt;
use tokio::sync::{Mutex, watch};
use crate::bluetooth::bluetooth_communication;
use crate::{balance_board_com, file_system};
use crate::balance_board_com::BalanceBoardConnection;

#[derive(Default)]
pub struct AppState {
    pub cancel_tx: Arc<Mutex<Option<watch::Sender<()>>>>,
    pub connected_devices: Arc<Mutex<HashMap<MacAddress, BalanceBoardConnection>>>,
    pub selected_devices: Arc<Mutex<Vec<MacAddress>>>,
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
            user_fetch_all_users,
            user_add,
            user_update,
            user_delete,
            devices_fetch_all_devices,
            devices_scan_without_timeout,
            devices_cancel_scan,
            devices_is_scanning,
            devices_connect_device,
            devices_remove_device,
            devices_identify_device
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
fn user_fetch_all_users() -> Result<Vec<User>, String> {
    println!(">> fetch_all_users");

    let result = UserFileSystem::get_users().map_err(|e| e.to_string());

    println!("<< fetch_all_users: {:?}", result);
    result
}

#[tauri::command]
fn user_add(user: User) -> Result<(), String> {
    println!(">> user_add: {:?}", user);

    let result = UserFileSystem::add_user(user).map_err(|e| e.to_string());

    println!("<< user_add: {:?}", result);
    result
}

#[tauri::command]
fn user_update(user: User) -> Result<(), String> {
    println!(">> user_update: {:?}", user);

    let result = UserFileSystem::update_user(user).map_err(|e| e.to_string());

    println!("<< user_update: {:?}", result);
    result
}

#[tauri::command]
fn user_delete(user_id: String) -> Result<(), String> {
    println!(">> user_delete: {}", user_id);

    let result = UserFileSystem::remove_user(user_id).map_err(|e| e.to_string());

    println!("<< user_delete: {:?}", result);
    result
}

// *********************************************************************
// DEVICES
// *********************************************************************

#[tauri::command(async)]
pub async fn devices_fetch_all_devices() -> Result<Vec<NintendoDevice>, String> {
    println!(">> devices_fetch_all_devices");

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

    println!("<< (devices_fetch_all_devices): Returning devices: #{:?}\n", result);

    Ok(result)
}

#[tauri::command(async)]
async fn devices_scan_without_timeout(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    println!(">> devices_scan_without_timeout");

    let mut cancel_tx_lock = state.cancel_tx.lock().await;
    if cancel_tx_lock.is_some() {
        return Err("A scan is already in progress.".to_string());
    }

    let (cancel_tx, mut cancel_rx) = watch::channel(());
    *cancel_tx_lock = Some(cancel_tx);
    drop(cancel_tx_lock);

    let app_clone = app.clone();
    let cancel_tx_arc = state.cancel_tx.clone();
    let connected_devices_arc = state.connected_devices.clone();

    tokio::spawn(async move {
        println!("Scanning for devices in background...");
        loop {
            tokio::select! {
                _ = cancel_rx.changed() => {
                    println!("Scan cancelled.");
                    break;
                }
                new_board_bluetooth = bluetooth_communication::connect_new_balance_board() => {
                    if let Ok(mac_address) = new_board_bluetooth {
                        tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;
                        let balance_board_hid = balance_board_com::connect(mac_address).map_err(|e| e.to_string());

                        match balance_board_hid {
                            Ok(balance_board) => {
                                connected_devices_arc.lock().await.insert(mac_address, balance_board);
                                println!("Added device! to balance board: {:?}", mac_address);
                            }
                            Err(e) => eprintln!("Error connecting to balance board: {:?}", e),
                        }

                        match bluetooth_communication::get_nintendo_device_by_mac_address(mac_address).await {
                            Ok(device) => app_clone.emit("new_board", NintendoDevice::from(device)).unwrap(),
                            Err(e) => eprintln!("Error getting device info by mac address: {:?}", e),
                        }
                    }
                }
            }
        }

        let mut cancel_tx_lock = cancel_tx_arc.lock().await;
        *cancel_tx_lock = None;
        println!("Exiting background scan task.");
    });

    println!("<< devices_scan_without_timeout: Scan started in background.\n");
    Ok(())
}

#[tauri::command]
async fn devices_cancel_scan(state: State<'_, AppState>) -> Result<(), String> {
    println!(">> cancel_scan");

    if let Some(cancel_tx) = state.cancel_tx.lock().await.take() {
        let _ = cancel_tx.send(());
    }

    println!("<< cancel_scan\n");
    Ok(())
}

#[tauri::command]
async fn devices_is_scanning(state: State<'_, AppState>) -> Result<bool, String> {
    println!(">> is_scanning");

    let cancel_tx_lock = state.cancel_tx.lock().await;
    let result = cancel_tx_lock.is_some();

    println!("<< is_scanning: {}\n", result);
    Ok(result)
}

#[tauri::command(async)]
fn devices_connect_device(mac_address: String, _channel: Channel<BalanceBoardEvent>) -> Result<(), String> {
    println!(">> devices_connect: {}", mac_address);

    println!("<< devices_connect: {:?}\n", mac_address);
    Ok(())
}

#[tauri::command(async)]
async fn devices_remove_device(mac_address: String) -> Result<(), String> {
    println!(">> devices_remove_device: {}", mac_address);

    let mac_address_bytes = convert_mac_address_string_to_u8_bytes(mac_address.as_str());
    let result = bluetooth_communication::remove_device(mac_address_bytes).await
        .map_err(|e| e.to_string());

    println!("<< devices_remove_device: {:?}\n", result);
    Ok(())
}



#[tauri::command(async)]
async fn devices_identify_device(mac_address: String, state: State<'_, AppState>) -> Result<(), String> {
    let mac_address_bytes = convert_mac_address_string_to_u8_bytes(mac_address.as_str());
    println!(">> devices_identify_device: {}", mac_address);


    let devices = state.connected_devices.lock().await;
    println!("Log: {:?}", devices.keys());
    println!("My key: {:?}", mac_address_bytes);
    let device = match devices.get(&mac_address_bytes) {
        Some(d) => d,
        None => {
            &balance_board_com::connect(mac_address_bytes).unwrap()
        }
    };
    let result = device.identify_board();
    println!("Result: {:?}", result);

    println!("<< devices_identify_device: {:?}\n", mac_address);
    Ok(())
}


/*
#[tauri::command(async)]
async fn recording_start_recording(mac_address: String) -> Result<(), String> {

}

#[tauri::command(async)]
async fn recording_stop_recording(mac_address: String) -> Result<(), String> {

}
*/

fn convert_mac_address_string_to_u8_bytes(mac_address: &str) -> [u8; 6] {
    let bytes: Vec<u8> = mac_address
        .split(':')
        .map(|part| u8::from_str_radix(part, 16).unwrap())
        .collect();

    bytes.try_into().unwrap()
}