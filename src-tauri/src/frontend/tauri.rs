use crate::file_system::UserFileSystem;
use crate::types::{NintendoDevice, User};
use crate::file_system;

use tokio::sync::{mpsc, oneshot};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_fs::FsExt;
use tokio::sync::mpsc::Sender;
use crate::actors::balance_board_actor::BoardAction;
use crate::actors::bluetooth_service::BluetoothCommand;
use crate::actors::toolkit_service::ToolkitCommand;

pub struct AppState {
    pub manager_tx: Sender<ToolkitCommand>,
}

pub fn initialize(manager_tx: Sender<ToolkitCommand>) {
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
pub async fn devices_fetch_all_devices(state: State<'_, AppState>) -> Result<Vec<NintendoDevice>, String> {
    println!(">> devices_fetch_all_devices");

    let (response_tx, mut response_rx) = oneshot::channel();
    let command = ToolkitCommand::GetBoardsSystemView { responder: response_tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;

    let result = response_rx.await.map_err(|e| e.to_string())?;

    println!("<< devices_fetch_all_devices: {:?}", result);
    Ok(result)
}

#[tauri::command(async)]
async fn devices_scan_without_timeout(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    println!(">> devices_scan_without_timeout");

    let (new_bluetooth_tx, mut new_bluetooth_rx) = mpsc::channel(10);
    let (hid_connection_tx, mut hid_connection_rx) = mpsc::channel(10);
    let manager_tx_clone = state.manager_tx.clone();

    // Flow: First we connect via bluetooth, then we connect via HID.
    tokio::spawn(async move {
        while let Some(device) = new_bluetooth_rx.recv().await {
            let (response_tx, mut response_rx) = oneshot::channel();
            manager_tx_clone.send(ToolkitCommand::Connect { device_id: "wow".to_string(), response: response_tx}).await.unwrap();

            match response_rx.await {
                Ok(result) => { hid_connection_tx.send(device).await.unwrap() }
                Err(_) => { } // Device was not HID connected succesfully.
            }
        }
    });
    tokio::spawn(async move {
        while let Some(device) = hid_connection_rx.recv().await {
            app.app_handle().emit("new_board", NintendoDevice::from(device)).unwrap()
        }
    });

    let command = ToolkitCommand::BluetoothAction {
        action: BluetoothCommand::StartScanAndPair {
            response_stream: new_bluetooth_tx
        }
    };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    
    println!("<< devices_scan_without_timeout: Scan started in background.\n");
    Ok(())
}

#[tauri::command]
async fn devices_cancel_scan(state: State<'_, AppState>) -> Result<(), String> {
    println!(">> cancel_scan");
    
    let command = ToolkitCommand::BluetoothAction { action: BluetoothCommand::StopScan };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;

    println!("<< cancel_scan\n");
    Ok(())
}

#[tauri::command]
async fn devices_is_scanning(state: State<'_, AppState>) -> Result<bool, String> {
    println!(">> is_scanning");

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::BluetoothAction { action: BluetoothCommand::IsScanning { response: tx} };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    let is_scanning = rx.await.map_err(|e| e.to_string())?;
    
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

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::Connect { device_id, response: tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    let result = rx.await.map_err(|e| e.to_string())?;

    println!("<< devices_connect_device: Connection command sent. {}", result);
    Ok(())
}

#[tauri::command(async)]
pub async fn devices_remove_device(mac_address: String, state: State<'_, AppState>) -> Result<(), String> {
    println!(">> devices_remove_device: {}", mac_address);

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::RemoveDevice { device_id: mac_address, response: tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    let result = rx.await.map_err(|e| e.to_string())?;

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

    let command = ToolkitCommand::IdentifyBoard {
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

    let command = ToolkitCommand::BoardAction {
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
