use std::path::PathBuf;
use crate::file_system;
use crate::file_system::UserFileSystem;
use crate::types::{FrontendReplayConfiguration, GeneralSettings, MacAddress, NintendoDevice, FrontendSessionInformation, User, UserPageInformation, FrontendCoreSession, FrontendLastSessionInformation, SessionActivityState};
use serde::Serialize;
use std::time::Duration;

use crate::actors::balance_board_actor::{BalanceBoardOutput, BoardAction};
use crate::actors::bluetooth_service::{BluetoothCommand, BluetoothPeripheral};
use crate::actors::state::activities::{Activity, TimelineBlock};
use crate::actors::toolkit_service::{ToolkitCommand, ToolkitResponse};
use tauri::ipc::Channel;
use tauri::{Emitter, Manager, State};
use tauri_plugin_fs::FsExt;
use tokio::sync::mpsc::{Receiver, Sender};
use tokio::sync::{mpsc, oneshot};
use crate::processing::data_processor::{AmplitudeSpectrum, FrequencySpectrum};

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
                        ToolkitResponse::NewDeviceFound(device) => {
                            app_handle.emit("new_board", device).unwrap()
                        },
                        ToolkitResponse::SessionCompleted => {
                            app_handle.emit("session_completed", ()).unwrap()
                        },
                        ToolkitResponse::ReplayCompleted => {
                            app_handle.emit("replay_completed", ()).unwrap()
                        },
                        ToolkitResponse::SessionStarted => {
                            app_handle.emit("session_started", ()).unwrap()
                        },
                        ToolkitResponse::SessionActivityChanged => {
                            app_handle.emit("session_activity_changed", ()).unwrap()
                        }
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
            user_create,
            user_update,
            user_delete,
            user_measure_weight,
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
            session_information,
            session_update_session_configuration,
            session_activity_state,
            replay_start_replay,
            replay_stop_replay,
            replay_information,
            replay_update,
            replay_load_file,
            replay_clear_replay,
            replay_load_last_session_info,
            activity_get_available_time_blocks,
            activity_get_activities,
            activity_get_activity,
            activity_update_activity,
            activity_reset_activity_to_default,
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
    rx.await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn user_page_information(state: State<'_, AppState>) -> Result<UserPageInformation, String> {
    println!(">> user_page_information");

    let users = UserFileSystem::get_users().map_err(|e| e.to_string())?;

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::GetSelectedUser { response: tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    let selected_user_id = rx.await.map_err(|e| e.to_string())?;

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::SelectedBoardsForSession { response: tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    let selected_boards = rx.await.map_err(|e| e.to_string())?;

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::GetBoardsSystemView { response: tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    let mut devices = rx.await.map_err(|e| e.to_string())?;
    devices.retain(|device| selected_boards.contains(&device.mac_address));

    let response = UserPageInformation {
        users,
        selected_user_id,
        session_devices: devices
    };

    println!("<< user_page_information: {:#?}", response);
    Ok(response)
}

#[tauri::command]
async fn user_select_user(state: State<'_, AppState>, user_id: usize) -> Result<(), String> {
    println!(">> user_select_user: {}", user_id);

    let command = ToolkitCommand::SelectUser { user_id };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command(async)]
async fn user_create(state: State<'_, AppState>) -> Result<User, String> {
    println!(">> user_create");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::CreateUser { response: response_tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    let result = response_rx.await.map_err(|e| e.to_string())?;

    println!("<< user_create {:#?}\n", result);
    Ok(result.as_ref().clone())
}

#[tauri::command(async)]
async fn user_update(user: User, state: State<'_, AppState>) -> Result<(), String> {
    println!(">> user_update: {:?}", user);

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::UpdateUser { user, response: response_tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    response_rx.await.map_err(|e| e.to_string())?;

    println!("<< user_update:\n");
    Ok(())
}

#[tauri::command(async)]
async fn user_delete(user_id: usize, state: State<'_, AppState>) -> Result<(), String> {
    println!(">> user_delete: {:?}", user_id);

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::DeleteUser { user_id, response: response_tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    response_rx.await.map_err(|e| e.to_string())?;

    println!("<< user_delete:\n");
    Ok(())
}

#[tauri::command(async)]
async fn user_measure_weight(state: State<'_, AppState>, channel: Channel<f64>, mac_address: MacAddress) -> Result<(), String> {
    println!(">> user_measure_weight");

    // Forward inner tauri messages to outer Tauri channel
    let (tx, mut rx) = mpsc::channel(100);
    tokio::spawn(async move {
        while let Some(data) = rx.recv().await {
            match channel.send(data) {
                Ok(_) => (),
                Err(_) => {
                    break;
                }
            }
        }
        println!("Weight measuring over");
    });
    let command = ToolkitCommand::MeasureWeight { frontend_channel: tx, mac_address };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;

    println!("<< user_measure_weight_return.\n");
    Ok(())
}

// --- DEVICE COMMANDS ---

#[tauri::command(async)]
async fn devices_fetch_all_devices(state: State<'_, AppState>) -> Result<Vec<NintendoDevice>, String> {
    println!(">> devices_fetch_all_devices");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::GetBoardsSystemView { response: response_tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;

    let result = response_rx.await.map_err(|e| e.to_string())?;

    println!("<< devices_fetch_all_devices: {:?}\n", result);
    Ok(result)
}

#[tauri::command(async)]
async fn devices_scan_without_timeout(state: State<'_, AppState>) -> Result<(), String> {
    println!(">> devices_scan_without_timeout");

    let (new_bluetooth_tx, mut new_bluetooth_rx) = mpsc::channel::<BluetoothPeripheral>(10);
    let manager_tx_clone = state.manager_tx.clone();

    // Flow: First we connect via bluetooth, then we connect via HID.
    tokio::spawn(async move {
        while let Some(device) = new_bluetooth_rx.recv().await {
            tokio::time::sleep(Duration::from_millis(4000)).await; // TODO Improve
            manager_tx_clone.send(ToolkitCommand::Connect { mac_address: device.mac_address}).await.unwrap();
        }
    });

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::BluetoothAction(BluetoothCommand::StartScanAndPair {
        response_stream: new_bluetooth_tx,
        response: tx
    });
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    rx.await.map_err(|e| e.to_string())?;
    
    println!("<< devices_scan_without_timeout: Scan started in background.\n");
    Ok(())
}

#[tauri::command]
async fn devices_cancel_scan(state: State<'_, AppState>) -> Result<(), String> {
    println!(">> cancel_scan");

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::BluetoothAction(BluetoothCommand::StopScan { response: tx });
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    rx.await.map_err(|e| e.to_string())?;

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
async fn devices_remove_device(mac_address: MacAddress, state: State<'_, AppState>) -> Result<(), String> {
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

    println!("<< devices_update_device_name\n");
    Ok(())
}

#[tauri::command(async)]
async fn devices_identify_device(
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

    println!("<< devices_identify_device: Identify command sent.\n");
    Ok(())
}

#[tauri::command(async)]
async fn devices_tare_device(
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

    println!("<< devices_tare_device: Tare command sent.\n");
    Ok(())
}


#[tauri::command(async)]
async fn devices_select_device(
    mac_address: MacAddress,
    state: State<'_, AppState>
) -> Result<(), String> {
    println!(">> devices_select_device: {}", mac_address);

    let command = ToolkitCommand::SelectBoardForSession { mac_address };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;

    println!("<< devices_select_device: \n");
    Ok(())
}

#[tauri::command(async)]
async fn devices_unselect_device(
    mac_address: MacAddress,
    state: State<'_, AppState>
) -> Result<(), String> {
    println!(">> devices_deselect_device: {}", mac_address);

    let command = ToolkitCommand::UnselectBoardForSession { mac_address };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;

    println!("<< devices_deselect_device: Tare command sent.\n");
    Ok(())
}

#[tauri::command(async)]
async fn devices_get_selected_devices(state: State<'_, AppState>) -> Result<Vec<MacAddress>, String> {
    println!(">> devices_get_selected_devices");

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::SelectedBoardsForSession { response: tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    let result = rx.await.map_err(|e| e.to_string())?;

    println!("<< devices_get_selected_devices. {:?}\n", result);
    Ok(result)
}

// ============================
// --- NEW SESSION COMMANDS ---
// ============================

#[tauri::command(async)]
async fn session_information(state: State<'_, AppState>) -> Result<FrontendSessionInformation, String> {
    println!(">> session_information");

    // When we receive a balance board reading, we send it to the frontend.
    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::SessionInformation { response: tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    let result = rx.await.map_err(|e| e.to_string())?;

    // TODO UNCOMMENT BELOW
    //println!("<< session_information. {:?}", result);
    Ok(result)
}

#[tauri::command(async)]
async fn session_update_session_configuration(configuration: FrontendCoreSession, state: State<'_, AppState>) -> Result<(), String> {
    println!(">> session_update_session_configuration: {:#?}", configuration);

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::UpdateSessionInformation { configuration, response: tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    rx.await.map_err(|e| e.to_string())?;

    println!("<< session_update_session_configuration.\n");
    Ok(())
}

// This returns all of the data needed for the Activity Popup.
// Namely, it gives the data for the activity, the current timeblock and the time until the next block.
#[tauri::command(async)]
async fn session_activity_state(state: State<'_, AppState>) -> Result<Option<SessionActivityState>, String> {
    println!(">> session_activity_state");

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::SessionActivityState { response: tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    let result = rx.await.map_err(|e| e.to_string())?;

    println!("<< session_activity_state. {:#?}\n", result);
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
    mac_address: MacAddress,
    timestamp: i64,
    weight: f32,
    cop_x: f32,
    cop_y: f32,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct FrontendProcessedReadingData {
    mac_address: MacAddress,
    timestamp: i64,
    v_cop_x: Option<f32>,
    v_cop_y: Option<f32>,
    confidence_ellipse_polygon: Option<Vec<(f32, f32)>>,
    convex_hull_polygon: Option<Vec<(f32, f32)>>,
    amplitude_spectrum: Option<AmplitudeSpectrum>,
    stability_index: Option<f32>,
    mlsi: Option<f32>,
    apsi: Option<f32>,
    vsi: Option<f32>,
    dpsi: Option<f32>,
}

#[tauri::command(async)]
async fn session_start_session(state: State<'_, AppState>, session_channel: Channel<FrontendBalanceBoardEvent>) -> Result<(), String> {
    println!(">> session_start_session");

    // When we receive a balance board reading, we send it to the frontend.
    let balance_board_tx = initialize_frontend_handler(session_channel).await;
    let command = ToolkitCommand::StartSession { frontend_channel: balance_board_tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;

    println!("<< session_start_session.\n");
    Ok(())
}

#[tauri::command(async)]
async fn session_stop_session(state: State<'_, AppState>) -> Result<(), String> {
    println!(">> session_stop_session");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::StopSession { response: response_tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    response_rx.await.map_err(|e| e.to_string())?;

    println!("<< session_stop_session.\n");
    Ok(())
}

// ===============================
// --- REPLAY SESSION COMMANDS ---
// ===============================

async fn initialize_frontend_handler(session_channel: Channel<FrontendBalanceBoardEvent>) -> Sender<BalanceBoardOutput> {
    let (balance_board_tx, mut balance_board_rx) = mpsc::channel(100);
    tokio::spawn(async move {
        while let Some(data) = balance_board_rx.recv().await {
            match data {
                BalanceBoardOutput::Raw(data) => {
                    let cop = data.calculate_cop();
                    let reading = FrontendRawReadingData {
                        mac_address: data.mac_address,
                        timestamp: data.timestamp.timestamp_millis(),
                        weight: data.top_right + data.top_left + data.bottom_right + data.bottom_left,
                        cop_x: cop.x,
                        cop_y: cop.y,
                    };
                    session_channel.send(FrontendBalanceBoardEvent::Raw(reading));
                }
                BalanceBoardOutput::Processed(data) => {
                    let reading = FrontendProcessedReadingData {
                        mac_address: data.mac_address,
                        timestamp: data.timestamp.timestamp_millis(),
                        v_cop_x: data.sway_metrics.as_ref().map(|m| m.v_cop_x),
                        v_cop_y: data.sway_metrics.as_ref().map(|m| m.v_cop_y),
                        confidence_ellipse_polygon: data.area_metrics.as_ref().map(|m| m.confidence_ellipse_polygon.clone()),
                        convex_hull_polygon: data.area_metrics.as_ref().map(|m| m.convex_hull_polygon.clone()),
                        amplitude_spectrum: data.amplitude_spectrum.clone(),
                        stability_index: data.stability_index.as_ref().map(|m| *m),
                        mlsi: data.dpsi_metrics.as_ref().map(|m| m.mlsi),
                        apsi: data.dpsi_metrics.as_ref().map(|m| m.apsi),
                        vsi: data.dpsi_metrics.as_ref().map(|m| m.vsi),
                        dpsi: data.dpsi_metrics.as_ref().map(|m| m.dpsi),
                    };
                    session_channel.send(FrontendBalanceBoardEvent::Processed(reading));
                }
            }
        };
    });
    balance_board_tx
}

#[tauri::command(async)]
async fn replay_start_replay(state: State<'_, AppState>, session_channel: Channel<FrontendBalanceBoardEvent>) -> Result<(), String> {
    println!(">> replay_start_replay");

    let balance_board_tx = initialize_frontend_handler(session_channel).await;
    let command = ToolkitCommand::StartReplay { frontend_channel: balance_board_tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;

    println!("<< replay_start_replay.\n");
    Ok(())
}

#[tauri::command(async)]
async fn replay_stop_replay(state: State<'_, AppState>) -> Result<(), String> {
    println!(">> replay_stop_replay");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::StopReplay { response: response_tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    response_rx.await.map_err(|e| e.to_string())?;

    println!("<< replay_stop_replay.\n");
    Ok(())
}

#[tauri::command(async)]
async fn replay_information(state: State<'_, AppState>) -> Result<Option<FrontendReplayConfiguration>, String> {
    println!(">> replay_information");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::ReplayInformation { response: response_tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    let result = response_rx.await.map_err(|e| e.to_string())?;

    println!("<< replay_information. {:#?}\n", result);
    Ok(result)
}

#[tauri::command(async)]
async fn replay_update(configuration: FrontendCoreSession, state: State<'_, AppState>) -> Result<(), String> {
    println!(">> replay_update");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::UpdateReplayInformation { configuration, response: response_tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    response_rx.await.map_err(|e| e.to_string())?;

    println!("<< replay_update.\n");
    Ok(())
}

#[tauri::command(async)]
async fn replay_load_file(file_path: PathBuf, state: State<'_, AppState>) -> Result<(), String> {
    println!(">> replay_load_file");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::LoadReplayFile { file_path, response: response_tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    response_rx.await.map_err(|e| e.to_string())?;

    println!("<< replay_load_file.\n");
    Ok(())
}

#[tauri::command(async)]
async fn replay_clear_replay(state: State<'_, AppState>) -> Result<(), String> {
    println!(">> replay_clear_replay");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::ClearReplay { response: response_tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    response_rx.await.map_err(|e| e.to_string())?;

    println!("<< replay_clear_replay.\n");
    Ok(())
}

#[tauri::command(async)]
async fn replay_load_last_session_info(state: State<'_, AppState>) -> Result<Option<FrontendLastSessionInformation>, String> {
    println!(">> replay_load_last_session_info");

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::LastSessionInformation { response: tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    let result = rx.await.map_err(|e| e.to_string())?;

    println!("<< replay_load_last_session_info: {:#?}\n", result);
    Ok(result)
}

// =========================
// --- ACTIVITY COMMANDS ---
// =========================

#[tauri::command(async)]
async fn activity_get_available_time_blocks(state: State<'_, AppState>) -> Result<Vec<TimelineBlock>, String> {
    println!(">> activity_get_available_time_blocks");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::GetAvailableTimeBlocks { response: response_tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    let result = response_rx.await.map_err(|e| e.to_string())?;

    //println!("<< activity_get_available_time_blocks. {:?}", result);
    Ok(result)
}

#[tauri::command(async)]
async fn activity_get_activities(state: State<'_, AppState>) -> Result<Vec<Activity>, String> {
    println!(">> activity_get_activities");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::GetActivities { response: response_tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    let result = response_rx.await.map_err(|e| e.to_string())?;

    // TODO: uncomment
    //println!("<< activity_get_activities. {:?}", result);
    Ok(result)
}

#[tauri::command(async)]
async fn activity_get_activity(activity_id: String, state: State<'_, AppState>) -> Result<Activity, String> {
    println!(">> activity_get_activity");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::GetActivity { activity_id, response: response_tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    let result = response_rx.await.map_err(|e| e.to_string())?;

    println!("<< activity_get_activity.\n");
    Ok(result)
}

#[tauri::command(async)]
async fn activity_update_activity(activity: Activity, state: State<'_, AppState>) -> Result<(), String> {
    println!(">> activity_update_activity");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::UpdateActivity { activity, response: Some(response_tx) };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    response_rx.await.map_err(|e| e.to_string())?;

    println!("<< activity_update_activity.\n");
    Ok(())
}

#[tauri::command(async)]
async fn activity_reset_activity_to_default(activity_id: String, state: State<'_, AppState>) -> Result<Activity, String> {
    println!(">> activity_reset_activity_to_default");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::ResetActivityToDefault { activity_id, response: response_tx };
    state.manager_tx.send(command).await.map_err(|e| e.to_string())?;
    let result = response_rx.await.map_err(|e| e.to_string())?;

    println!("<< activity_reset_activity_to_default.\n");
    Ok(result)
}