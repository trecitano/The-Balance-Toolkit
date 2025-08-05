use std::time::Duration;
use crate::file_system::UserFileSystem;
use crate::types::{NintendoDevice, User};
use crate::file_system;

use tokio::sync::{mpsc, oneshot};
use tauri::{Emitter, Manager, State};
use tauri::ipc::Channel;
use tauri_plugin_fs::FsExt;
use tokio::sync::mpsc::{Sender, Receiver};
use crate::actors::balance_board_actor::{BalanceBoardOutput, BalanceBoardSessionSettings, BoardAction, SettingMode, SettingWithMode};
use crate::actors::bluetooth_service::{BluetoothCommand, BluetoothPeripheral};
use crate::actors::toolkit_service::{ToolkitCommand, ToolkitResponse};
use crate::processing::data_processor::ProcessingSettings;

pub struct AppState {
    pub manager_tx: Sender<ToolkitCommand>,
}

pub fn initialize(manager_tx: Sender<ToolkitCommand>, mut manager_rx: Receiver<ToolkitResponse>) {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // allowed the given directory
            let app_dir = file_system::app_dir();
            let scope = app.fs_scope();
            scope.allow_directory(app_dir, true)?;

            let app_handle = app.app_handle().clone();
            tokio::spawn(async move {
                while let Some(new_event) = manager_rx.recv().await {
                    match new_event {
                        ToolkitResponse::NewDeviceFound(device) =>
                            app_handle.emit("new_board", NintendoDevice::from(device)).unwrap()
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            user_fetch_all_users,
            user_add,
            user_update,
            user_delete,
            devices_get_selected_devices,
            devices_fetch_all_devices,
            devices_scan_without_timeout,
            devices_cancel_scan,
            devices_is_scanning,
            devices_select_device,
            devices_unselect_device,
            devices_remove_device,
            devices_identify_device,
            devices_tare_device,
            session_start_session,
            session_stop_session
        ])
        .manage(AppState { manager_tx })
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

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::GetBoardsSystemView { responder: response_tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;

    let result = response_rx.await.map_err(|e| e.to_string())?;

    println!("<< devices_fetch_all_devices: {:?}", result);
    Ok(result)
}

#[tauri::command(async)]
async fn devices_scan_without_timeout(state: State<'_, AppState>) -> Result<(), String> {
    println!(">> devices_scan_without_timeout");

    let (new_bluetooth_tx, mut new_bluetooth_rx) = mpsc::channel::<BluetoothPeripheral>(10);
    let (hid_connection_tx, mut hid_connection_rx) = mpsc::channel(10);
    let manager_tx_clone = state.manager_tx.clone();

    // Flow: First we connect via bluetooth, then we connect via HID.
    tokio::spawn(async move {
        while let Some(device) = new_bluetooth_rx.recv().await {
            let (response_tx, response_rx) = oneshot::channel();

            tokio::time::sleep(Duration::from_millis(2000)).await; // TODO Improve

            manager_tx_clone.send(ToolkitCommand::Connect { device_id: device.id.clone(), mac_address: device.mac_address, response: response_tx}).await.unwrap();

            match response_rx.await {
                Ok(_) => { hid_connection_tx.send(device).await.unwrap() }
                Err(_) => { } // Device was not HID connected succesfully.
            }
        }
    });

    let command = ToolkitCommand::BluetoothAction(BluetoothCommand::StartScanAndPair {
            response_stream: new_bluetooth_tx
        });
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    
    println!("<< devices_scan_without_timeout: Scan started in background.\n");
    Ok(())
}

#[tauri::command]
async fn devices_cancel_scan(state: State<'_, AppState>) -> Result<(), String> {
    println!(">> cancel_scan");
    
    let command = ToolkitCommand::BluetoothAction(BluetoothCommand::StopScan);
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;

    println!("<< cancel_scan\n");
    Ok(())
}

#[tauri::command]
async fn devices_is_scanning(state: State<'_, AppState>) -> Result<bool, String> {
    println!(">> is_scanning");

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::BluetoothAction(BluetoothCommand::IsScanning { response: tx});
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    let is_scanning = rx.await.map_err(|e| e.to_string())?;
    
    println!("<< is_scanning: {}\n", is_scanning);
    Ok(is_scanning)
}

#[tauri::command(async)]
pub async fn devices_remove_device(device_id: String, state: State<'_, AppState>) -> Result<(), String> {
    println!(">> devices_remove_device: {}", device_id);

    let command = ToolkitCommand::BluetoothAction(BluetoothCommand::RemoveDevice { device_id });
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;

    println!("<< devices_remove_device\n");
    Ok(())
}

#[tauri::command(async)]
pub async fn devices_identify_device(
    device_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    println!(">> devices_identify_device: {}", device_id);

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
    state: State<'_, AppState>
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


#[tauri::command(async)]
pub async fn devices_select_device(
    device_id: String,
    state: State<'_, AppState>
) -> Result<(), String> {
    println!(">> devices_select_device: {}", device_id);

    let command = ToolkitCommand::SelectBoardForSession { device_id };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;

    println!("<< devices_select_device: Tare command sent.");
    Ok(())
}

#[tauri::command(async)]
pub async fn devices_unselect_device(
    device_id: String,
    state: State<'_, AppState>
) -> Result<(), String> {
    println!(">> devices_deselect_device: {}", device_id);

    let command = ToolkitCommand::UnselectBoardForSession { device_id };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;

    println!("<< devices_deselect_device: Tare command sent.");
    Ok(())
}

#[tauri::command(async)]
pub async fn devices_get_selected_devices(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    println!(">> devices_get_selected_devices");

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::SelectedBoardsForSession { response: tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    let result = rx.await.map_err(|e| e.to_string())?;

    println!("<< devices_get_selected_devices. {:?}", result);
    Ok(result)
}

#[tauri::command(async)]
pub async fn session_start_session(state: State<'_, AppState>, session_channel: Channel<BalanceBoardOutput>) -> Result<(), String> {
    println!(">> session_start_session");

    // When we receive a balance board reading, we send it to the frontend.
    let (balance_board_tx, mut balance_board_rx) = mpsc::channel(100);
    tokio::spawn(async move {
        while let Some(data) = balance_board_rx.recv().await {
            session_channel.send(data);
        };
    });

    let command = ToolkitCommand::StartSession { settings: BalanceBoardSessionSettings {
        output_directory: Some(SettingWithMode { value: file_system::app_dir().to_str().unwrap().to_string(), mode: SettingMode::all() }),
        frontend_channel: Some(SettingWithMode { value: balance_board_tx, mode: SettingMode::processed_only() }),
        lsl_connection: None,
        tcp_connection_string: None,
        processing_settings: Some(ProcessingSettings::default())
    }};
    state.manager_tx.send(command)
        .await
        .map_err(|e| e.to_string())?;

    println!("<< session_start_session.");
    Ok(())
}

#[tauri::command(async)]
pub async fn session_stop_session(state: State<'_, AppState>) -> Result<(), String> {
    println!(">> session_stop_session");

    state.manager_tx.send(ToolkitCommand::StopSession)
        .await
        .map_err(|e| e.to_string())?;

    println!("<< session_stop_session.");
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
