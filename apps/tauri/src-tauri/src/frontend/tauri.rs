use serde::Serialize;
use std::path::PathBuf;
use tauri::ipc::Channel;
use tauri::{Emitter, Manager, State};
use tokio::sync::mpsc::{Receiver, Sender};
use tokio::sync::{mpsc, oneshot};
use toolkit_core::actors::balance_board_actor::{
    BalanceBoardCalibratedReading, BalanceBoardOutput, BoardAction,
};
use toolkit_core::actors::bluetooth_service::{BluetoothCommand, BluetoothPeripheral};
use toolkit_core::actors::state::activities::{Activity, TimelineBlock};
use toolkit_core::actors::toolkit_service::{
    DeviceCalibrationData, ToolkitCommand, ToolkitResponse,
};
use toolkit_core::processing::data_processor::AmplitudeSpectrum;
use toolkit_core::types::{
    FrontendCapturedReading, FrontendCoreSession, FrontendLastSessionInformation,
    FrontendReplayConfiguration, FrontendSessionInformation, GeneralSettings, MacAddress,
    NintendoDevice, SessionActivityState, User, UserPageInformation,
};

pub struct AppState {
    pub manager_tx: Sender<ToolkitCommand>,
}

pub fn initialize(manager_tx: Sender<ToolkitCommand>, mut manager_rx: Receiver<ToolkitResponse>) {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_handle = app.app_handle().clone();
            tokio::spawn(async move {
                while let Some(new_event) = manager_rx.recv().await {
                    match new_event {
                        ToolkitResponse::NewDeviceFound(device) => {
                            app_handle.emit("new_board", device).unwrap()
                        }
                        ToolkitResponse::BoardDisconnected(device) => {
                            app_handle.emit("board_disconnected", device).unwrap()
                        }
                        ToolkitResponse::SessionCompleted => {
                            app_handle.emit("session_completed", ()).unwrap()
                        }
                        ToolkitResponse::ReplayCompleted => {
                            app_handle.emit("replay_completed", ()).unwrap()
                        }
                        ToolkitResponse::SessionStarted => {
                            app_handle.emit("session_started", ()).unwrap()
                        }
                        ToolkitResponse::SessionActivityChanged => {
                            app_handle.emit("session_activity_changed", ()).unwrap()
                        }
                    }
                }
            });

            let monitor_dimensions = app
                .primary_monitor()
                .ok()
                .flatten()
                .map(|monitor| {
                    let size = monitor.size();
                    (size.width as f64, size.height as f64)
                })
                .or_else(|| {
                    app.available_monitors().ok().and_then(|monitors| {
                        monitors.into_iter().next().map(|monitor| {
                            let size = monitor.size();
                            (size.width as f64, size.height as f64)
                        })
                    })
                });

            let (initial_width, initial_height) = monitor_dimensions
                .map(|(width, height)| (width * 0.55, height * 0.6))
                .unwrap_or((800.0, 600.0));

            tauri::WebviewWindowBuilder::new(app.handle(), "main", tauri::WebviewUrl::default())
                .title("The Balance Toolkit")
                .resizable(true)
                .maximizable(true)
                .inner_size(initial_width, initial_height)
                .build()?;

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
            devices_start_calibration_stream,
            devices_stop_calibration_stream,
            devices_submit_calibration,
            session_start_session,
            session_stop_session,
            session_information,
            session_update_session_configuration,
            session_activity_state,
            session_tare_devices,
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
    log::debug!(">> settings_get_settings");

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::GetSettings { response: tx };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    let result = rx.await.map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command(async)]
async fn settings_set_settings(
    settings: GeneralSettings,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log::debug!(">> settings_set_settings");

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::SaveSettings {
        settings,
        response: tx,
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    rx.await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn user_page_information(state: State<'_, AppState>) -> Result<UserPageInformation, String> {
    log::debug!(">> user_page_information");

    // One round trip, served entirely from the manager's memory.
    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::UserPageInformation { response: tx };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    let response = rx.await.map_err(|e| e.to_string())?;

    Ok(response)
}

#[tauri::command]
async fn user_select_user(state: State<'_, AppState>, user_id: usize) -> Result<(), String> {
    log::debug!(">> user_select_user: {}", user_id);

    let command = ToolkitCommand::SelectUser { user_id };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command(async)]
async fn user_create(state: State<'_, AppState>) -> Result<User, String> {
    log::debug!(">> user_create");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::CreateUser {
        response: response_tx,
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    let result = response_rx.await.map_err(|e| e.to_string())?;

    Ok(result.as_ref().clone())
}

#[tauri::command(async)]
async fn user_update(user: User, state: State<'_, AppState>) -> Result<(), String> {
    log::debug!(">> user_update: {}", user.id);

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::UpdateUser {
        user,
        response: response_tx,
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    response_rx.await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command(async)]
async fn user_delete(user_id: usize, state: State<'_, AppState>) -> Result<(), String> {
    log::debug!(">> user_delete: {:?}", user_id);

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::DeleteUser {
        user_id,
        response: response_tx,
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    response_rx.await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command(async)]
async fn user_measure_weight(
    state: State<'_, AppState>,
    channel: Channel<f64>,
    mac_address: MacAddress,
) -> Result<(), String> {
    log::debug!(">> user_measure_weight");

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
        log::debug!("Weight measuring over");
    });
    let command = ToolkitCommand::MeasureWeight {
        frontend_channel: tx,
        mac_address,
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// --- DEVICE COMMANDS ---

#[tauri::command(async)]
async fn devices_fetch_all_devices(
    state: State<'_, AppState>,
) -> Result<Vec<NintendoDevice>, String> {
    log::debug!(">> devices_fetch_all_devices");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::GetBoardsSystemView {
        response: response_tx,
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;

    let result = response_rx.await.map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command(async)]
async fn devices_scan_without_timeout(state: State<'_, AppState>) -> Result<(), String> {
    log::debug!(">> devices_scan_without_timeout");

    let (new_bluetooth_tx, mut new_bluetooth_rx) = mpsc::channel::<BluetoothPeripheral>(10);
    let manager_tx_clone = state.manager_tx.clone();

    // Flow: First we connect via bluetooth, then we connect via HID.
    tokio::spawn(async move {
        while let Some(device) = new_bluetooth_rx.recv().await {
            manager_tx_clone
                .send(ToolkitCommand::Connect {
                    mac_address: device.mac_address,
                })
                .await
                .unwrap();
        }
    });

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::BluetoothAction(BluetoothCommand::StartScanAndPair {
        response_stream: new_bluetooth_tx,
        response: tx,
    });
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    rx.await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn devices_cancel_scan(state: State<'_, AppState>) -> Result<(), String> {
    log::debug!(">> cancel_scan");

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::BluetoothAction(BluetoothCommand::StopScan { response: tx });
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    rx.await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn devices_is_scanning(state: State<'_, AppState>) -> Result<bool, String> {
    log::debug!(">> is_scanning");

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::BluetoothAction(BluetoothCommand::IsScanning { response: tx });
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    let is_scanning = rx.await.map_err(|e| e.to_string())?;

    Ok(is_scanning)
}

#[tauri::command(async)]
async fn devices_remove_device(
    mac_address: MacAddress,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log::debug!(">> devices_remove_device: {}", mac_address);

    let command = ToolkitCommand::BluetoothAction(BluetoothCommand::RemoveDevice { mac_address });
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command(async)]
async fn devices_update_device_name(
    mac_address: MacAddress,
    device_name: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log::debug!(
        ">> devices_update_device_name: {} -> {}",
        mac_address,
        device_name
    );

    let command = ToolkitCommand::UpdateBoardName {
        mac_address,
        device_name,
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command(async)]
async fn devices_identify_device(
    mac_address: MacAddress,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log::debug!(">> devices_identify_device: {}", mac_address);

    let command = ToolkitCommand::IdentifyBoard { mac_address };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command(async)]
async fn devices_tare_device(
    mac_address: MacAddress,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log::debug!(">> devices_tare_device: {}", mac_address);

    let command = ToolkitCommand::BoardAction {
        mac_address,
        action: BoardAction::Tare,
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Frontend-friendly calibration sensor reading
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct FrontendCalibrationReading {
    mac_address: MacAddress,
    timestamp: i64,
    top_left: f32,
    top_right: f32,
    bottom_left: f32,
    bottom_right: f32,
    total_weight: f32,
}

#[tauri::command(async)]
async fn devices_start_calibration_stream(
    mac_address: MacAddress,
    calibration_channel: Channel<FrontendCalibrationReading>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log::debug!(">> devices_start_calibration_stream: {}", mac_address);

    // Create internal channel for calibration data
    let (tx, mut rx) = mpsc::channel::<BalanceBoardCalibratedReading>(100);

    // Spawn task to forward data to frontend channel
    tokio::spawn(async move {
        while let Some(reading) = rx.recv().await {
            let frontend_reading = FrontendCalibrationReading {
                mac_address: reading.mac_address,
                timestamp: reading.timestamp.timestamp_millis(),
                top_left: reading.top_left,
                top_right: reading.top_right,
                bottom_left: reading.bottom_left,
                bottom_right: reading.bottom_right,
                total_weight: reading.top_left
                    + reading.top_right
                    + reading.bottom_left
                    + reading.bottom_right,
            };
            if calibration_channel.send(frontend_reading).is_err() {
                log::debug!("Calibration channel closed");
                break;
            }
        }
        log::debug!("Calibration stream forwarding ended");
    });

    let command = ToolkitCommand::StartCalibrationStream {
        mac_address,
        frontend_channel: tx,
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command(async)]
async fn devices_stop_calibration_stream(
    mac_address: MacAddress,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log::debug!(">> devices_stop_calibration_stream: {}", mac_address);

    let command = ToolkitCommand::StopCalibrationStream { mac_address };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command(async)]
async fn devices_submit_calibration(
    mac_address: MacAddress,
    weight_kg: f64,
    readings: Vec<FrontendCapturedReading>,
    state: State<'_, AppState>,
) -> Result<DeviceCalibrationData, String> {
    log::debug!(
        ">> devices_submit_calibration: {} with {}kg and {} readings",
        mac_address,
        weight_kg,
        readings.len()
    );

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::SubmitCalibration {
        mac_address,
        weight_kg,
        readings,
        response: response_tx,
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    response_rx.await.map_err(|e| e.to_string())?
}

#[tauri::command(async)]
async fn devices_select_device(
    mac_address: MacAddress,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log::debug!(">> devices_select_device: {}", mac_address);

    let command = ToolkitCommand::SelectBoardForSession { mac_address };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command(async)]
async fn devices_unselect_device(
    mac_address: MacAddress,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log::debug!(">> devices_deselect_device: {}", mac_address);

    let command = ToolkitCommand::UnselectBoardForSession { mac_address };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command(async)]
async fn devices_get_selected_devices(
    state: State<'_, AppState>,
) -> Result<Vec<MacAddress>, String> {
    log::debug!(">> devices_get_selected_devices");

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::SelectedBoardsForSession { response: tx };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    let result = rx.await.map_err(|e| e.to_string())?;

    Ok(result)
}

// ============================
// --- NEW SESSION COMMANDS ---
// ============================

#[tauri::command(async)]
async fn session_information(
    state: State<'_, AppState>,
) -> Result<FrontendSessionInformation, String> {
    log::debug!(">> session_information");

    // When we receive a balance board reading, we send it to the frontend.
    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::SessionInformation { response: tx };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    let result = rx.await.map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command(async)]
async fn session_update_session_configuration(
    configuration: FrontendCoreSession,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log::debug!(">> session_update_session_configuration");

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::UpdateSessionInformation {
        configuration,
        response: tx,
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    rx.await.map_err(|e| e.to_string())?;

    Ok(())
}

// This returns all of the data needed for the Activity Popup.
// Namely, it gives the data for the activity, the current timeblock and the time until the next block.
#[tauri::command(async)]
async fn session_activity_state(
    state: State<'_, AppState>,
) -> Result<Option<SessionActivityState>, String> {
    log::debug!(">> session_activity_state");

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::SessionActivityState { response: tx };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    let result = rx.await.map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command(async)]
async fn session_tare_devices(state: State<'_, AppState>) -> Result<(), String> {
    log::debug!(">> session_tare_devices");

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::SessionTareDevices { response: tx };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    rx.await.map_err(|e| e.to_string())?;

    Ok(())
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
async fn session_start_session(
    state: State<'_, AppState>,
    session_channel: Channel<FrontendBalanceBoardEvent>,
) -> Result<(), String> {
    log::debug!(">> session_start_session");

    // When we receive a balance board reading, we send it to the frontend.
    let balance_board_tx = initialize_frontend_handler(session_channel).await;
    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::StartSession {
        frontend_channel: balance_board_tx,
        response: response_tx,
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    response_rx.await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command(async)]
async fn session_stop_session(state: State<'_, AppState>) -> Result<(), String> {
    log::debug!(">> session_stop_session");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::StopSession {
        response: response_tx,
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    response_rx.await.map_err(|e| e.to_string())?;

    Ok(())
}

// ===============================
// --- REPLAY SESSION COMMANDS ---
// ===============================

async fn initialize_frontend_handler(
    session_channel: Channel<FrontendBalanceBoardEvent>,
) -> Sender<BalanceBoardOutput> {
    // Deep enough to ride out a webview stall of a few seconds at two boards x 100 Hz.
    // Producers skip samples for a full channel rather than dropping the frontend entirely.
    let (balance_board_tx, mut balance_board_rx) = mpsc::channel(2048);
    tokio::spawn(async move {
        while let Some(data) = balance_board_rx.recv().await {
            match data {
                BalanceBoardOutput::Raw(data) => {
                    let cop = data.calculate_cop();
                    let reading = FrontendRawReadingData {
                        mac_address: data.mac_address,
                        timestamp: data.timestamp.timestamp_millis(),
                        weight: data.top_right
                            + data.top_left
                            + data.bottom_right
                            + data.bottom_left,
                        cop_x: cop.x,
                        cop_y: cop.y,
                    };
                    if session_channel
                        .send(FrontendBalanceBoardEvent::Raw(reading))
                        .is_err()
                    {
                        break;
                    }
                }
                BalanceBoardOutput::Processed(data) => {
                    let reading = FrontendProcessedReadingData {
                        mac_address: data.mac_address,
                        timestamp: data.timestamp.timestamp_millis(),
                        v_cop_x: data.sway_metrics.as_ref().map(|m| m.v_cop_x),
                        v_cop_y: data.sway_metrics.as_ref().map(|m| m.v_cop_y),
                        confidence_ellipse_polygon: data
                            .area_metrics
                            .as_ref()
                            .map(|m| m.confidence_ellipse_polygon.clone()),
                        convex_hull_polygon: data
                            .area_metrics
                            .as_ref()
                            .map(|m| m.convex_hull_polygon.clone()),
                        amplitude_spectrum: data.amplitude_spectrum.clone(),
                        stability_index: data.stability_index.as_ref().map(|m| *m),
                        mlsi: data.dpsi_metrics.as_ref().map(|m| m.mlsi),
                        apsi: data.dpsi_metrics.as_ref().map(|m| m.apsi),
                        vsi: data.dpsi_metrics.as_ref().map(|m| m.vsi),
                        dpsi: data.dpsi_metrics.as_ref().map(|m| m.dpsi),
                    };
                    if session_channel
                        .send(FrontendBalanceBoardEvent::Processed(reading))
                        .is_err()
                    {
                        break;
                    }
                }
            }
        }
    });
    balance_board_tx
}

#[tauri::command(async)]
async fn replay_start_replay(
    state: State<'_, AppState>,
    session_channel: Channel<FrontendBalanceBoardEvent>,
) -> Result<(), String> {
    log::debug!(">> replay_start_replay");

    let balance_board_tx = initialize_frontend_handler(session_channel).await;
    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::StartReplay {
        frontend_channel: balance_board_tx,
        response: response_tx,
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    response_rx.await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command(async)]
async fn replay_stop_replay(state: State<'_, AppState>) -> Result<(), String> {
    log::debug!(">> replay_stop_replay");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::StopReplay {
        response: response_tx,
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    response_rx.await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command(async)]
async fn replay_information(
    state: State<'_, AppState>,
) -> Result<Option<FrontendReplayConfiguration>, String> {
    log::debug!(">> replay_information");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::ReplayInformation {
        response: response_tx,
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    let result = response_rx.await.map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command(async)]
async fn replay_update(
    configuration: FrontendCoreSession,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log::debug!(">> replay_update");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::UpdateReplayInformation {
        configuration,
        response: response_tx,
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    response_rx.await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command(async)]
async fn replay_load_file(file_path: PathBuf, state: State<'_, AppState>) -> Result<(), String> {
    log::debug!(">> replay_load_file");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::LoadReplayFile {
        file_path,
        response: response_tx,
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    response_rx.await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command(async)]
async fn replay_clear_replay(state: State<'_, AppState>) -> Result<(), String> {
    log::debug!(">> replay_clear_replay");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::ClearReplay {
        response: response_tx,
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    response_rx.await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command(async)]
async fn replay_load_last_session_info(
    state: State<'_, AppState>,
) -> Result<Option<FrontendLastSessionInformation>, String> {
    log::debug!(">> replay_load_last_session_info");

    let (tx, rx) = oneshot::channel();
    let command = ToolkitCommand::LastSessionInformation { response: tx };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    let result = rx.await.map_err(|e| e.to_string())?;

    Ok(result)
}

// =========================
// --- ACTIVITY COMMANDS ---
// =========================

#[tauri::command(async)]
async fn activity_get_available_time_blocks(
    state: State<'_, AppState>,
) -> Result<Vec<TimelineBlock>, String> {
    log::debug!(">> activity_get_available_time_blocks");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::GetAvailableTimeBlocks {
        response: response_tx,
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    let result = response_rx.await.map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command(async)]
async fn activity_get_activities(state: State<'_, AppState>) -> Result<Vec<Activity>, String> {
    log::debug!(">> activity_get_activities");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::GetActivities {
        response: response_tx,
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    let result = response_rx.await.map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command(async)]
async fn activity_get_activity(
    activity_id: String,
    state: State<'_, AppState>,
) -> Result<Activity, String> {
    log::debug!(">> activity_get_activity");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::GetActivity {
        activity_id,
        response: response_tx,
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    let result = response_rx.await.map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command(async)]
async fn activity_update_activity(
    activity: Activity,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log::debug!(">> activity_update_activity");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::UpdateActivity {
        activity,
        response: Some(response_tx),
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    response_rx.await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command(async)]
async fn activity_reset_activity_to_default(
    activity_id: String,
    state: State<'_, AppState>,
) -> Result<Activity, String> {
    log::debug!(">> activity_reset_activity_to_default");

    let (response_tx, response_rx) = oneshot::channel();
    let command = ToolkitCommand::ResetActivityToDefault {
        activity_id,
        response: response_tx,
    };
    state
        .manager_tx
        .send(command)
        .await
        .map_err(|e| e.to_string())?;
    let result = response_rx.await.map_err(|e| e.to_string())?;

    Ok(result)
}
