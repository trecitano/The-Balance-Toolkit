use crate::bluetooth::bluetooth_communication;
use crate::file_system::{DeviceFileSystem, UserFileSystem};
use crate::service::ManagerCommand;
use crate::types::{NintendoDevice, User};
use crate::file_system;

use tokio::sync::oneshot;
use tauri::{AppHandle, State};
use tauri_plugin_fs::FsExt;
use tokio::sync::mpsc::Sender;
use crate::balance_board_com::BoardAction;

pub struct AppState {
    pub manager_tx: Sender<ManagerCommand>,
}

pub fn initialize(manager_tx: Sender<ManagerCommand>) {
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
        .manage(AppState { manager_tx: manager_tx })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


// --- USER COMMANDS ---

#[tauri::command]
pub fn user_fetch_all_users() -> Result<Vec<User>, String> {
    println!(">> fetch_all_users");
    UserFileSystem::get_users().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn user_add(user: User) -> Result<(), String> {
    println!(">> user_add: {:?}", user);
    UserFileSystem::add_user(user).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn user_update(user: User) -> Result<(), String> {
    println!(">> user_update: {:?}", user);
    UserFileSystem::update_user(user).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn user_delete(user_id: String) -> Result<(), String> {
    println!(">> user_delete: {}", user_id);
    UserFileSystem::remove_user(user_id).map_err(|e| e.to_string())
}

// --- DEVICE COMMANDS ---

#[tauri::command(async)]
pub async fn devices_fetch_all_devices() -> Result<Vec<NintendoDevice>, String> {
    println!(">> devices_fetch_all_devices");

    let stored_devices = DeviceFileSystem::get_stored_devices().map_err(|e| e.to_string())?;
    let connected_devices: Vec<NintendoDevice> =
        bluetooth_communication::get_nintendo_devices()
            .await
            .map_err(|e| e.to_string())?
            .into_iter()
            .map(|p| p.into())
            .collect();

    let mut result = stored_devices;
    for device in connected_devices {
        if let Some(found) = result.iter_mut().find(|d| d.mac_address == device.mac_address) {
            found.last_connected = None; // Or update with new connection time
        } else {
            result.push(device);
        }
    }

    println!("<< devices_fetch_all_devices: {:?}", result);
    Ok(result)
}

#[tauri::command(async)]
async fn devices_scan_without_timeout(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    println!(">> devices_scan_without_timeout");

    let command = ManagerCommand::StartScan { device_found_channel: app.clone()};
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    
    println!("<< devices_scan_without_timeout: Scan started in background.\n");
    Ok(())
}

#[tauri::command]
async fn devices_cancel_scan(state: State<'_, AppState>) -> Result<(), String> {
    println!(">> cancel_scan");
    
    let command = ManagerCommand::StopScan;
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;

    println!("<< cancel_scan\n");
    Ok(())
}

#[tauri::command]
async fn devices_is_scanning(state: State<'_, AppState>) -> Result<bool, String> {
    println!(">> is_scanning");

    let (cancel_tx, mut cancel_rx) = oneshot::channel();
    let command = ManagerCommand::IsScanning { responder: cancel_tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    
    let is_scanning = cancel_rx.await.map_err(|e| e.to_string())?;
    
    println!("<< is_scanning: {}\n", is_scanning);
    Ok(is_scanning)
}


#[tauri::command(async)]
pub async fn devices_connect_device(
    mac_address: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    println!(">> devices_connect_device: {}", mac_address);
    let device_id = convert_mac_address_string_to_device_id(&mac_address);

    let command = ManagerCommand::Connect { device_id };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;

    println!("<< devices_connect_device: Connection command sent.");
    Ok(())
}

#[tauri::command(async)]
pub async fn devices_remove_device(mac_address: String) -> Result<(), String> {
    println!(">> devices_remove_device: {}", mac_address);

    let mac_address_bytes = convert_mac_address_string_to_u8_bytes(&mac_address);
    let result = bluetooth_communication::remove_device(mac_address_bytes)
        .await
        .map_err(|e| e.to_string());
    // TODO: Remove from communication as well

    println!("<< devices_remove_device: {:?}\n", result);
    Ok(())
}

#[tauri::command(async)]
pub async fn devices_identify_device(
    mac_address: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    println!(">> devices_identify_device: {}", mac_address);
    let device_id = convert_mac_address_string_to_device_id(&mac_address);

    let command = ManagerCommand::IdentifyBoard {
        device_id,
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;

    println!("<< devices_identify_device: Identify command sent.");
    Ok(())
}

#[tauri::command(async)]
pub async fn devices_tare_device(
    mac_address: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    println!(">> devices_tare_device: {}", mac_address);
    let device_id = convert_mac_address_string_to_device_id(&mac_address);

    let command = ManagerCommand::BoardAction {
        device_id,
        action: BoardAction::Tare,
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;

    println!("<< devices_tare_device: Tare command sent.");
    Ok(())
}

// --- UTILITY FUNCTIONS ---

fn convert_mac_address_string_to_u8_bytes(mac_address: &str) -> [u8; 6] {
    let bytes: Vec<u8> = mac_address
        .split(':')
        .map(|part| u8::from_str_radix(part, 16).unwrap_or(0))
        .collect();
    bytes.try_into().unwrap_or([0; 6])
}

fn convert_mac_address_string_to_device_id(mac_address: &str) -> String {
    mac_address.replace(':', "")
}
