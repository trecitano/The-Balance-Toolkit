use crate::file_system;
use crate::file_system::UserFileSystem;
use crate::types::{GeneralSettings, MacAddress, NintendoDevice, SessionInformation, User, UserPageInformation};
use serde::Serialize;
use std::time::Duration;

use crate::actors::balance_board_actor::{BalanceBoardOutput, BoardAction};
use crate::actors::bluetooth_service::{BluetoothCommand, BluetoothPeripheral};
use crate::actors::toolkit_service::{ToolkitCommand, ToolkitResponse};
use crate::processing::data_processor::ProcessedBoardData;
use tauri::ipc::Channel;
use tauri::{Emitter, Manager, State};
use tauri_plugin_fs::FsExt;
use tokio::sync::mpsc::{Receiver, Sender};
use tokio::sync::{mpsc, oneshot};

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
            settings_get_settings,
            settings_set_settings,
            user_page_information,
            user_select_user,
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
            devices_update_device_name,
            devices_remove_device,
            devices_identify_device,
            devices_tare_device,
            session_start_session,
            session_stop_session,
            session_information
        ])
        .manage(AppState { manager_tx })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


// --- USER COMMANDS ---
#[tauri::command(async)]
async fn settings_get_settings(state: State<'_, AppState>) -> Result<GeneralSettings, String> {
    println!(">> settings_get_settings");

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::GetSettings { response: tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    let result = rx.await.map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command(async)]
async fn settings_set_settings(settings: GeneralSettings, state: State<'_, AppState>) -> Result<(), String> {
    println!(">> settings_set_settings: {:?}", settings);

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::SaveSettings { settings, response: tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    // Wait for possible toolkit restart
    rx.await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn user_page_information(state: State<'_, AppState>) -> Result<UserPageInformation, String> {
    println!(">> fetch_all_users");

    let users = UserFileSystem::get_users().map_err(|e| e.to_string())?;
    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::GetSelectedUser { response: response_tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    let result = response_rx.await.map_err(|e| e.to_string())?;

    let response = UserPageInformation {
        users,
        selected_user: result,
    };

    Ok(response)
}

#[tauri::command]
async fn user_select_user(state: State<'_, AppState>, user_name: String) -> Result<(), String> {
    println!(">> user_select_user: {}", user_name);

    let command = ToolkitCommand::SelectUser { user_name };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;

    Ok(())
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
pub fn user_delete(user_name: String) -> Result<(), String> {
    println!(">> user_delete: {}", user_name);
    UserFileSystem::remove_user(user_name).map_err(|e| e.to_string())
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

            manager_tx_clone.send(ToolkitCommand::Connect { mac_address: device.mac_address, response: response_tx}).await.unwrap();

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
pub async fn devices_remove_device(mac_address: MacAddress, state: State<'_, AppState>) -> Result<(), String> {
    println!(">> devices_remove_device: {}", mac_address);

    let command = ToolkitCommand::BluetoothAction(BluetoothCommand::RemoveDevice { mac_address });
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;

    println!("<< devices_remove_device\n");
    Ok(())
}

#[tauri::command(async)]
async fn devices_update_device_name(mac_address: MacAddress,
                                    device_name: String,
                                    state: State<'_, AppState>)
    -> Result<(), String> {
    println!(">> devices_update_device_name: {} -> {}", mac_address, device_name);

    let command = ToolkitCommand::UpdateBoardName { mac_address, device_name };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;

    println!("<< devices_update_device_name");
    Ok(())
}

#[tauri::command(async)]
pub async fn devices_identify_device(
    mac_address: MacAddress,
    state: State<'_, AppState>,
) -> Result<(), String> {
    println!(">> devices_identify_device: {}", mac_address);

    let command = ToolkitCommand::IdentifyBoard { mac_address };
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
    mac_address: MacAddress,
    state: State<'_, AppState>
) -> Result<(), String> {
    println!(">> devices_tare_device: {}", mac_address);

    let command = ToolkitCommand::BoardAction { mac_address, action: BoardAction::Tare };
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
    mac_address: MacAddress,
    state: State<'_, AppState>
) -> Result<(), String> {
    println!(">> devices_select_device: {}", mac_address);

    let command = ToolkitCommand::SelectBoardForSession { mac_address };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;

    println!("<< devices_select_device: Tare command sent.");
    Ok(())
}

#[tauri::command(async)]
pub async fn devices_unselect_device(
    mac_address: MacAddress,
    state: State<'_, AppState>
) -> Result<(), String> {
    println!(">> devices_deselect_device: {}", mac_address);

    let command = ToolkitCommand::UnselectBoardForSession { mac_address };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;

    println!("<< devices_deselect_device: Tare command sent.");
    Ok(())
}

#[tauri::command(async)]
pub async fn devices_get_selected_devices(state: State<'_, AppState>) -> Result<Vec<MacAddress>, String> {
    println!(">> devices_get_selected_devices");

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::SelectedBoardsForSession { response: tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    let result = rx.await.map_err(|e| e.to_string())?;

    println!("<< devices_get_selected_devices. {:?}", result);
    Ok(result)
}

// ========================
// --- SESSION COMMANDS ---
// ========================

#[tauri::command(async)]
async fn session_information(state: State<'_, AppState>) -> Result<SessionInformation, String> {
    println!(">> session_information");

    // When we receive a balance board reading, we send it to the frontend.
    let (tx, mut rx) = oneshot::channel();
    let command = ToolkitCommand::SessionInformation { response: tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    let result = rx.await.map_err(|e| e.to_string())?;

    println!("<< session_information. {:?}", result);
    Ok(result)
}

#[derive(Serialize, Debug, Clone)]
#[serde(tag = "event", rename_all = "camelCase")]
enum FrontendBalanceBoardEvent {
    Raw(FrontendRawReadingData),
    Processed(FrontendProcessedReadingData),
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct FrontendRawReadingData {
    timestamp: i64,
    board_id: String,
    data: FrontendRawReadingCopData,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct FrontendRawReadingCopData {
    cop_x: f32,
    cop_y: f32,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct FrontendProcessedReadingData {
    board_id: String,
    data: ProcessedBoardData,
}

#[tauri::command(async)]
pub async fn session_start_session(state: State<'_, AppState>, session_channel: Channel<FrontendBalanceBoardEvent>) -> Result<(), String> {
    println!(">> session_start_session");

    // When we receive a balance board reading, we send it to the frontend.
    let (balance_board_tx, mut balance_board_rx) = mpsc::channel(100);
    tokio::spawn(async move {
        while let Some(data) = balance_board_rx.recv().await {
            match data {
                BalanceBoardOutput::Raw(data) => {
                    let cop = data.calculate_cop();
                    let reading = FrontendRawReadingData {
                        timestamp: data.timestamp.timestamp_millis(),
                        board_id: "Board One".to_string(),
                        data: FrontendRawReadingCopData {
                            cop_x: cop.x,
                            cop_y: cop.y,
                        }
                    };
                    session_channel.send(FrontendBalanceBoardEvent::Raw(reading));
                }
                BalanceBoardOutput::Processed(data) => {
                    let reading = FrontendProcessedReadingData {
                        board_id: "Board One".to_string(),
                        data,
                    };
                    session_channel.send(FrontendBalanceBoardEvent::Processed(reading));
                }
            }
        };
    });

    let command = ToolkitCommand::StartSession { frontend_channel: balance_board_tx };
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
