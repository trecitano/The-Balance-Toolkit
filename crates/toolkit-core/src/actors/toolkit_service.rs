use crate::actors::balance_board_actor;
use crate::actors::balance_board_actor::{
    BalanceBoardCalibratedReading, BalanceBoardOutput, BoardAction, BoardConnectionMode,
};
use crate::actors::bluetooth_service::{BluetoothCommand, BluetoothService};
use crate::actors::state::activities::{Activity, ActivityState, TimelineBlock};
use crate::actors::state::users::UserState;
use crate::file_system::{DeviceFileSystem, ExistingSessionFileSystem, SettingsFileSystem};
use crate::processing::data_processor::{InterpolationSetting, ProcessingSettings};
use crate::processing::lsl_writer::LslConnectionSettings;
use crate::processing::{data_processor, file_writer, lsl_writer, tcp_writer};
use crate::types::{
    FrontendCapturedReading, FrontendCoreSession, FrontendLastSessionInformation,
    FrontendReplayConfiguration, FrontendSessionInformation, GeneralSettings, MacAddress,
    NintendoDevice, OngoingSessionActivityState, SelectOption, SelectedBoard, SessionActivityState,
    User, UserPageInformation,
};
use crate::{NINTENDO_BOARD_ID, utils};
use anyhow::{Result, anyhow};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc::Receiver;
use tokio::sync::mpsc::Sender;
use tokio::sync::mpsc::error::TrySendError;
use tokio::sync::{mpsc, oneshot};
use tokio_util::sync::CancellationToken;

/// Calibration position identifier
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum CalibrationPosition {
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
    Center,
}

impl CalibrationPosition {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "top_left" => Some(Self::TopLeft),
            "top_right" => Some(Self::TopRight),
            "bottom_left" => Some(Self::BottomLeft),
            "bottom_right" => Some(Self::BottomRight),
            "center" => Some(Self::Center),
            _ => None,
        }
    }
}

/// Data captured at a single calibration position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalibrationPositionData {
    pub position: CalibrationPosition,
    pub weight_kg: f64,
    pub sensor_readings: BalanceBoardCalibratedReading,
}

/// Complete calibration data for a device
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCalibrationData {
    pub mac_address: MacAddress,
    pub calibration_weight_kg: f64,
    pub positions: HashMap<CalibrationPosition, CalibrationPositionData>,
}

// Commands that can be sent to the ConnectionManager
#[derive(Debug)]
pub enum ToolkitCommand {
    GetSettings {
        response: oneshot::Sender<GeneralSettings>,
    },
    SaveSettings {
        settings: GeneralSettings,
        response: oneshot::Sender<bool>,
    },

    // Manager main actions
    BluetoothAction(BluetoothCommand),

    GetBoardsSystemView {
        response: oneshot::Sender<Vec<NintendoDevice>>,
    },

    // Users
    SelectUser {
        user_id: usize,
    },
    UserPageInformation {
        response: oneshot::Sender<UserPageInformation>,
    },
    CreateUser {
        response: oneshot::Sender<Arc<User>>,
    },
    UpdateUser {
        user: User,
        response: oneshot::Sender<()>,
    },
    DeleteUser {
        user_id: usize,
        response: oneshot::Sender<()>,
    },
    MeasureWeight {
        frontend_channel: Sender<f64>,
        mac_address: MacAddress,
    },

    Connect {
        mac_address: MacAddress,
    },
    IdentifyBoard {
        mac_address: MacAddress,
    },
    UpdateBoardName {
        mac_address: MacAddress,
        device_name: String,
    },

    SelectBoardForSession {
        mac_address: MacAddress,
    },
    UnselectBoardForSession {
        mac_address: MacAddress,
    },
    SelectedBoardsForSession {
        response: oneshot::Sender<Vec<MacAddress>>,
    },

    // Activities
    GetAvailableTimeBlocks {
        response: oneshot::Sender<Vec<TimelineBlock>>,
    },
    GetActivities {
        response: oneshot::Sender<Vec<Activity>>,
    },
    GetActivity {
        activity_id: String,
        response: oneshot::Sender<Activity>,
    },
    UpdateActivity {
        activity: Activity,
        response: Option<oneshot::Sender<()>>,
    },
    ResetActivityToDefault {
        activity_id: String,
        response: oneshot::Sender<Activity>,
    },

    // Session
    LastSessionInformation {
        response: oneshot::Sender<Option<FrontendLastSessionInformation>>,
    },
    SessionInformation {
        response: oneshot::Sender<FrontendSessionInformation>,
    },
    UpdateSessionInformation {
        configuration: FrontendCoreSession,
        response: oneshot::Sender<()>,
    },
    StartSession {
        frontend_channel: Sender<BalanceBoardOutput>,
        response: oneshot::Sender<()>,
    },
    StopSession {
        response: oneshot::Sender<()>,
    },
    SessionActivityState {
        response: oneshot::Sender<Option<SessionActivityState>>,
    },
    SessionTareDevices {
        response: oneshot::Sender<()>,
    },

    // Replay session
    ReplayInformation {
        response: oneshot::Sender<Option<FrontendReplayConfiguration>>,
    },
    LoadReplayFile {
        file_path: PathBuf,
        response: oneshot::Sender<()>,
    },
    ClearReplay {
        response: oneshot::Sender<()>,
    },
    UpdateReplayInformation {
        configuration: FrontendCoreSession,
        response: oneshot::Sender<()>,
    },
    StartReplay {
        frontend_channel: Sender<BalanceBoardOutput>,
        response: oneshot::Sender<()>,
    },
    StopReplay {
        response: oneshot::Sender<()>,
    },

    BoardAction {
        mac_address: MacAddress,
        action: BoardAction,
    },

    // Calibration
    StartCalibrationStream {
        mac_address: MacAddress,
        frontend_channel: Sender<BalanceBoardCalibratedReading>,
    },
    StopCalibrationStream {
        mac_address: MacAddress,
    },
    SubmitCalibration {
        mac_address: MacAddress,
        weight_kg: f64,
        readings: Vec<FrontendCapturedReading>,
        response: oneshot::Sender<Result<DeviceCalibrationData, String>>,
    },
}

pub enum ToolkitResponse {
    NewDeviceFound(MacAddress),
    SessionCompleted,
    ReplayCompleted,
    SessionStarted,
    SessionActivityChanged,
}

pub struct ConnectionManager {
    tx: Sender<ToolkitCommand>,
    rx: Receiver<ToolkitCommand>,
    response_tx: Sender<ToolkitResponse>,
    bluetooth_manager_tx: Sender<BluetoothCommand>,
    activity_state: ActivityState,
    user_state: UserState,
    general_settings: GeneralSettings,
    session_settings: SessionConfiguration,
    replay_settings: Option<ReplayConfiguration>,
    all_connections: HashMap<MacAddress, Sender<BoardAction>>,
    /// Every board this manager has ever seen, with the user-facing names from the device
    /// file. Refreshed by `boards_system_view`; read by anything that only needs names, so
    /// routine UI refetches never have to touch the Bluetooth stack.
    known_devices: Vec<NintendoDevice>,
    /// Tracks active calibration streams (mac_address -> cancellation flag)
    active_calibration_streams: HashMap<MacAddress, CancellationToken>,
}

#[derive(Clone)]
pub struct SessionConfiguration {
    pub core: CoreSessionConfiguration,
    pub connections: HashMap<MacAddress, Sender<BoardAction>>,
    pub session_start_time: Option<chrono::DateTime<Utc>>,
    pub cancel_token: Option<CancellationToken>,
}

#[derive(Clone, Debug)]
pub struct CoreSessionConfiguration {
    pub user: Arc<User>,
    pub activity: Option<Activity>,
    pub lsl_enabled: bool,
    pub tcp_enabled: bool,
    pub output_directory: PathBuf,
    pub window_size_ms: u64,
    pub window_slide_ms: u64,
    pub sampling_rate: u64,
    pub interpolation: InterpolationSetting,
}

#[derive(Clone, Debug)]
pub struct ReplayConfiguration {
    pub core: CoreSessionConfiguration,
    pub file_path: PathBuf,
    pub device_names: HashMap<MacAddress, String>,
    pub connections: HashMap<MacAddress, Sender<BoardAction>>,
    pub replay_duration: Duration,
    pub replay_start_time: Option<chrono::DateTime<Utc>>,
    pub cancel_token: Option<CancellationToken>,
}

impl ConnectionManager {
    pub fn new(response_tx: Sender<ToolkitResponse>) -> Result<Self> {
        let (tx, rx) = mpsc::channel(100);

        let activity_state = ActivityState::new()?;
        let user_state = UserState::new()?;

        let general_settings = SettingsFileSystem::get_or_create_default_settings()?;
        let known_devices = DeviceFileSystem::get_stored_devices()?;
        let session_settings = SessionConfiguration {
            core: CoreSessionConfiguration {
                user: user_state.get_default_user(),
                activity: None,
                lsl_enabled: false,
                tcp_enabled: false,
                output_directory: general_settings.store_files_default_directory.clone(),
                window_size_ms: general_settings.processing_settings.window_size_ms,
                window_slide_ms: general_settings.processing_settings.window_slide_ms,
                sampling_rate: general_settings.processing_settings.sampling_rate,
                interpolation: general_settings.processing_settings.interpolation.clone(),
            },
            connections: HashMap::new(),
            session_start_time: None,
            cancel_token: None,
        };

        Ok(Self {
            rx,
            tx,
            response_tx,
            bluetooth_manager_tx: BluetoothService::start_bluetooth_handler(
                general_settings.is_demo_mode,
            ),
            activity_state,
            user_state,

            general_settings,
            session_settings,
            replay_settings: None,
            all_connections: HashMap::new(),
            known_devices,
            active_calibration_streams: HashMap::new(),
        })
    }

    pub fn get_sender_channel(&self) -> Sender<ToolkitCommand> {
        self.tx.clone()
    }

    pub async fn run(mut self) -> Result<()> {
        log::info!("Toolkit service started.");

        while let Some(command) = self.rx.recv().await {
            // A failing command must not take the whole manager (and with it every board
            // connection) down: log it and keep serving the next one.
            if let Err(e) = self.handle_command(command).await {
                log::error!("Toolkit command failed: {e:#}");
            }
        }

        log::info!("Toolkit service stopped.");
        Ok(())
    }

    async fn handle_command(&mut self, command: ToolkitCommand) -> Result<()> {
        match command {
            ToolkitCommand::GetSettings { response } => {
                let _ = response.send(self.general_settings.clone());
            }
            ToolkitCommand::SaveSettings { settings, response } => {
                self.update_settings_and_restart_toolkit(settings).await?;
                let _ = response.send(true);
            }

            ToolkitCommand::BluetoothAction(action) => match action {
                BluetoothCommand::RemoveDevice { mac_address } => {
                    if let Some(connection) = self.all_connections.remove(&mac_address) {
                        connection.send(BoardAction::StopRecording).await?;
                    }
                    self.session_settings.connections.remove(&mac_address);
                    self.known_devices.retain(|d| d.mac_address != mac_address);
                    DeviceFileSystem::remove_device(mac_address)?;
                    self.bluetooth_manager_tx.send(action).await?
                }
                _ => self.bluetooth_manager_tx.send(action).await?,
            },
            ToolkitCommand::GetBoardsSystemView {
                response: responder,
            } => {
                let result = self.boards_system_view().await?;
                let _ = responder.send(result);
            }
            ToolkitCommand::MeasureWeight {
                frontend_channel,
                mac_address,
            } => {
                // Weight measurements semantics:
                // 1 - We cannot make a weight measurement if a session is ongoing
                // 2 - We only perform a weight measurement on a specific board
                // 3 - When the user closes the channel, we stop reading from the board.
                if self.session_settings.session_start_time.is_some() {
                    return Ok(());
                }

                let Some(board) = self.session_settings.connections.get(&mac_address) else {
                    log::warn!(
                        "Weight measurement requested for a board that is not in the session: {}",
                        utils::mac_address_human_name(mac_address)
                    );
                    return Ok(());
                };
                let (raw_data_tx, mut raw_data_rx) = mpsc::channel(10);
                let command = BoardAction::StartRecording(raw_data_tx);
                board.send(command).await?;

                let board_clone = board.clone();
                tokio::spawn(async move {
                    while let Some(data) = raw_data_rx.recv().await {
                        let weight =
                            data.top_left + data.top_right + data.bottom_left + data.bottom_right;
                        if frontend_channel.send(weight as f64).await.is_err() {
                            log::debug!("Weight measurement channel is closed, stopping recording");
                            let _ = board_clone.send(BoardAction::StopRecording).await;
                            break;
                        }
                    }
                });
            }

            ToolkitCommand::Connect { mac_address } => {
                self.connect(mac_address).await?;
            }
            ToolkitCommand::IdentifyBoard { mac_address } => {
                self.identify_board(mac_address);
            }
            ToolkitCommand::UpdateBoardName {
                mac_address,
                device_name,
            } => {
                if let Some(device) = self
                    .known_devices
                    .iter_mut()
                    .find(|d| d.mac_address == mac_address)
                {
                    device.name = device_name.clone();
                }
                DeviceFileSystem::update_board_name(mac_address, device_name)?
            }

            // Users
            ToolkitCommand::SelectUser { user_id } => {
                let user = self.user_state.get_user(user_id);
                self.session_settings.core.user = user;
            }
            ToolkitCommand::UserPageInformation { response } => {
                let information = UserPageInformation {
                    users: self
                        .user_state
                        .get_users()
                        .iter()
                        .map(|user| user.as_ref().clone())
                        .collect(),
                    selected_user_id: self.session_settings.core.user.id,
                    session_devices: self.session_boards(),
                };
                let _ = response.send(information);
            }
            ToolkitCommand::CreateUser { response } => {
                let new_user = self.user_state.create_user()?;
                let _ = response.send(new_user);
            }
            ToolkitCommand::UpdateUser { user, response } => {
                self.user_state.update_user(user)?;
                let _ = response.send(());
            }
            ToolkitCommand::DeleteUser { user_id, response } => {
                self.user_state.delete_user(user_id)?;
                let _ = response.send(());
            }

            ToolkitCommand::SelectBoardForSession { mac_address } => {
                if let Some(connection) = self.all_connections.get(&mac_address) {
                    self.session_settings
                        .connections
                        .insert(mac_address, connection.clone());
                }
            }
            ToolkitCommand::UnselectBoardForSession { mac_address } => {
                self.session_settings.connections.remove(&mac_address);
            }
            ToolkitCommand::SelectedBoardsForSession { response } => {
                let _ = response.send(self.session_settings.connections.keys().cloned().collect());
            }

            ToolkitCommand::GetAvailableTimeBlocks { response } => {
                let result = self.activity_state.get_available_time_blocks();
                let _ = response.send(result);
            }
            ToolkitCommand::GetActivities { response } => {
                let activities = self.activity_state.get_copy_of_activities();
                let _ = response.send(activities);
            }
            ToolkitCommand::GetActivity {
                activity_id,
                response,
            } => {
                let activity = self
                    .activity_state
                    .get_copy_of_activity(&activity_id)
                    .ok_or_else(|| anyhow!("Unknown activity: {activity_id}"))?;
                let _ = response.send(activity);
            }
            ToolkitCommand::UpdateActivity { activity, response } => {
                self.activity_state.update_activity(activity)?;

                if let Some(response) = response {
                    let _ = response.send(());
                }
            }
            ToolkitCommand::ResetActivityToDefault {
                activity_id,
                response,
            } => {
                let activity = self.activity_state.reset_activity(&activity_id)?;
                let _ = response.send(activity);
            }

            ToolkitCommand::LastSessionInformation { response } => {
                match ExistingSessionFileSystem::load_latest_session_file(
                    &self.general_settings.store_files_default_directory,
                ) {
                    Some((file_path, session)) => {
                        let result = FrontendLastSessionInformation {
                            user: session.user,
                            session_stats: session.session_stats,
                            file_location: file_path,
                            activity: session.activity,
                        };
                        let _ = response.send(Some(result));
                    }
                    None => {
                        let _ = response.send(None);
                    }
                }
            }
            ToolkitCommand::SessionInformation { response } => {
                // This is refetched by the UI after every configuration change, so it must
                // stay cheap: everything comes from memory.
                let selected_boards: Vec<SelectedBoard> = self
                    .session_boards()
                    .into_iter()
                    .map(|device| SelectedBoard {
                        name: device.name,
                        mac_address: device.mac_address,
                    })
                    .collect();

                let session_information = FrontendSessionInformation {
                    available_users: self
                        .user_state
                        .get_users()
                        .iter()
                        .map(|user| SelectOption {
                            label: user.name.clone(),
                            value: user.id,
                        })
                        .collect(),
                    selected_boards,
                    core: (&self.session_settings.core).into(),
                    activity: self.session_settings.core.activity.clone(),
                    has_ongoing_session: self.session_settings.session_start_time.is_some(),
                };
                let _ = response.send(session_information);
            }
            ToolkitCommand::UpdateSessionInformation {
                configuration,
                response,
            } => {
                self.session_settings.core.user =
                    self.user_state.get_user(configuration.selected_user);
                self.session_settings.core.lsl_enabled = configuration.lsl_enabled;
                self.session_settings.core.tcp_enabled = configuration.tcp_enabled;
                self.session_settings.core.output_directory = configuration.output_directory;
                self.session_settings.core.window_size_ms = configuration.window_size_ms;
                self.session_settings.core.window_slide_ms = configuration.window_slide_ms;
                self.session_settings.core.sampling_rate = configuration.sampling_rate;
                self.session_settings.core.interpolation = configuration.interpolation;

                // If the activity has changed, let's reset it
                if let Some(activity_id) = configuration.activity_id {
                    let needs_update = self
                        .session_settings
                        .core
                        .activity
                        .as_ref()
                        .is_none_or(|a| a.id != *activity_id);

                    if needs_update {
                        self.session_settings.core.activity =
                            self.activity_state.get_copy_of_activity(&activity_id);

                        // Warn any interested listeners
                        self.response_tx
                            .send(ToolkitResponse::SessionActivityChanged)
                            .await?;
                    }
                } else {
                    self.session_settings.core.activity = None;
                }

                let _ = response.send(());
            }
            ToolkitCommand::StartSession {
                frontend_channel,
                response,
            } => {
                let cancellation_token = CancellationToken::new();
                self.session_settings.cancel_token = Some(cancellation_token.clone());
                self.session_settings.session_start_time = Some(Utc::now());
                let device_names = self.connected_device_names();

                start_session(
                    frontend_channel,
                    &self.general_settings,
                    &self.session_settings.core,
                    &self.session_settings.connections,
                    device_names,
                )
                .await;

                // Warn any interested listeners
                self.response_tx
                    .send(ToolkitResponse::SessionStarted)
                    .await?;

                if let Some(activity) = &self.session_settings.core.activity {
                    let manager_tx = self.get_sender_channel();

                    // If the session has an activity that starts with a tare, then perform the tare
                    if !activity.timeline_blocks.is_empty()
                        && activity.timeline_blocks[0].id == "tare"
                    {
                        for device in self.session_settings.connections.values() {
                            device.send(BoardAction::Tare).await?
                        }
                    }

                    // Cancel the session when the activity ends
                    let duration = activity.get_total_duration_ms() as u64;
                    let response_tx = self.response_tx.clone();
                    tokio::spawn(async move {
                        log::debug!("Going to sleep for {duration}");
                        tokio::select! {
                            _ = tokio::time::sleep(Duration::from_millis(duration)) => {
                                log::info!("Activity duration ended, stopping session...");
                                let (stop_tx, stop_rx) = oneshot::channel();
                                let _ = manager_tx.send(ToolkitCommand::StopSession { response: stop_tx }).await;
                                let _ = stop_rx.await;
                                let _ = response_tx.send(ToolkitResponse::SessionCompleted).await;
                            }
                            _ = cancellation_token.cancelled() => {
                                log::debug!("Session cancelled manually, auto-stop task exiting.");
                                let _ = response_tx.send(ToolkitResponse::SessionCompleted).await;
                            }
                        }
                    });
                }

                // Reply only once the session state is updated, so a refetch triggered by the
                // frontend after this command returns already sees the session as ongoing.
                let _ = response.send(());
            }
            ToolkitCommand::StopSession { response } => {
                if let Some(token) = self.session_settings.cancel_token.take() {
                    token.cancel();
                }

                for board in self.session_settings.connections.values() {
                    let command = { BoardAction::StopRecording };
                    board.send(command).await?
                }

                self.session_settings.session_start_time = None;
                let _ = response.send(());
            }
            ToolkitCommand::SessionActivityState { response } => {
                let Some(activity) = self.session_settings.core.activity.clone() else {
                    let _ = response.send(None);
                    return Ok(());
                };

                let total_loop_duration_ms = activity.get_total_duration_ms();
                let ongoing_state = match self.session_settings.session_start_time {
                    Some(start_time) if total_loop_duration_ms > 0 => {
                        let elapsed_ms = (Utc::now() - start_time).num_milliseconds().max(0) as i32;

                        let current_loop_number = elapsed_ms / total_loop_duration_ms;
                        let elapsed_in_current_loop = elapsed_ms % total_loop_duration_ms;

                        let mut accumulated = 0;
                        let mut current_block_index: i32 = 0;
                        let mut time_to_next_block_ms = 0;

                        for (i, block) in activity.timeline_blocks.iter().enumerate() {
                            let block_duration_ms = block.duration * 1000;
                            if elapsed_in_current_loop < accumulated + block_duration_ms {
                                current_block_index = i as i32;
                                time_to_next_block_ms = (accumulated + block_duration_ms)
                                    .saturating_sub(elapsed_in_current_loop);
                                break;
                            }
                            accumulated += block_duration_ms;
                        }

                        Some(OngoingSessionActivityState {
                            current_block_index,
                            time_to_next_block_ms,
                            loop_number: current_loop_number,
                        })
                    }
                    _ => None,
                };

                let _ = response.send(Some(SessionActivityState {
                    activity,
                    ongoing_state,
                }));
            }
            ToolkitCommand::SessionTareDevices { response } => {
                for tx in self.session_settings.connections.values() {
                    tx.send(BoardAction::Tare).await?
                }
                let _ = response.send(());
            }

            ToolkitCommand::BoardAction {
                mac_address,
                action,
            } => {
                self.board_action(mac_address, action).await;
            }

            ToolkitCommand::ReplayInformation { response } => match self.replay_settings.as_ref() {
                Some(settings) => {
                    let session_information = Some(settings.into());
                    let _ = response.send(session_information);
                }
                None => {
                    let _ = response.send(None);
                }
            },
            ToolkitCommand::LoadReplayFile {
                file_path,
                response,
            } => {
                let file_session = ExistingSessionFileSystem::load(&file_path)?;
                let directory = file_path
                    .parent()
                    .ok_or(anyhow!("Can't access parent directory of session file."))?;

                let mut connections = HashMap::new();
                for mac_address in file_session.device_names.keys() {
                    let raw_file_name = &file_session
                        .device_file_mappings
                        .get(mac_address)
                        .ok_or_else(|| {
                            anyhow!("Session file has no raw file for board {mac_address:012x}")
                        })?
                        .raw_file_name;
                    // We assume that the raw file is in the same directory as the session file.
                    let raw_file_path = directory.join(raw_file_name);

                    let tx = balance_board_actor::initialize(
                        *mac_address,
                        BoardConnectionMode::ReadFromFile(raw_file_path),
                    )?;
                    connections.insert(*mac_address, tx);
                }

                self.replay_settings = Some(ReplayConfiguration {
                    core: CoreSessionConfiguration {
                        user: Arc::new(file_session.user),
                        activity: file_session.activity,
                        lsl_enabled: false,
                        tcp_enabled: false,
                        output_directory: PathBuf::new(),
                        window_size_ms: file_session.window_size_ms,
                        window_slide_ms: file_session.window_slide_ms,
                        sampling_rate: file_session.sampling_rate,
                        interpolation: file_session.interpolation,
                    },
                    file_path,
                    device_names: file_session.device_names,
                    connections,
                    replay_duration: file_session.session_stats.duration,
                    replay_start_time: None,
                    cancel_token: None,
                });

                let _ = response.send(());
            }
            ToolkitCommand::ClearReplay { response } => {
                self.replay_settings = None;
                let _ = response.send(());
            }
            ToolkitCommand::UpdateReplayInformation {
                configuration,
                response,
            } => {
                if let Some(settings) = self.replay_settings.as_mut() {
                    settings.core.lsl_enabled = configuration.lsl_enabled;
                    settings.core.tcp_enabled = configuration.tcp_enabled;
                    settings.core.output_directory = configuration.output_directory;
                    settings.core.window_size_ms = configuration.window_size_ms;
                    settings.core.window_slide_ms = configuration.window_slide_ms;
                    settings.core.sampling_rate = configuration.sampling_rate;
                    settings.core.interpolation = configuration.interpolation;
                }

                let _ = response.send(());
            }
            ToolkitCommand::StartReplay {
                frontend_channel,
                response,
            } => {
                if let Some(settings) = self.replay_settings.as_mut() {
                    start_session(
                        frontend_channel,
                        &self.general_settings,
                        &settings.core,
                        &settings.connections,
                        settings.device_names.clone(),
                    )
                    .await;

                    // Cancel the replay when the activity ends
                    let cancellation_token = CancellationToken::new();
                    settings.replay_start_time = Some(Utc::now());
                    settings.cancel_token = Some(cancellation_token.clone());
                    let duration = settings.replay_duration;
                    let manager_tx = self.get_sender_channel();
                    let response_tx = self.response_tx.clone();
                    tokio::spawn(async move {
                        tokio::select! {
                            _ = tokio::time::sleep(duration) => {
                                log::info!("Activity duration ended, stopping replay...");
                                let (stop_tx, stop_rx) = oneshot::channel();
                                let _ = manager_tx.send(ToolkitCommand::StopReplay { response: stop_tx }).await;
                                let _ = stop_rx.await;
                                let _ = response_tx.send(ToolkitResponse::ReplayCompleted).await;
                            }
                            _ = cancellation_token.cancelled() => {
                                log::debug!("Replay cancelled manually, auto-stop task exiting.");
                                let _ = response_tx.send(ToolkitResponse::ReplayCompleted).await;
                            }
                        }
                    });
                }

                let _ = response.send(());
            }
            ToolkitCommand::StopReplay { response } => {
                if let Some(settings) = self.replay_settings.as_mut() {
                    for board in settings.connections.values() {
                        let command = { BoardAction::StopRecording };
                        board.send(command).await?
                    }
                    settings.replay_start_time = None;
                }

                let _ = response.send(());
            }

            // Calibration commands
            ToolkitCommand::StartCalibrationStream {
                mac_address,
                frontend_channel,
            } => {
                self.start_calibration_stream(mac_address, frontend_channel)
                    .await;
            }
            ToolkitCommand::StopCalibrationStream { mac_address } => {
                self.stop_calibration_stream(mac_address).await;
            }
            ToolkitCommand::SubmitCalibration {
                mac_address,
                weight_kg,
                readings,
                response,
            } => {
                let result = self
                    .submit_calibration(mac_address, weight_kg, readings)
                    .await;
                let _ = response.send(result);
            }
        }
        Ok(())
    }

    /// Name of a board as the user knows it, from the device cache or the MAC address.
    fn device_name(&self, mac_address: MacAddress) -> String {
        self.known_devices
            .iter()
            .find(|d| d.mac_address == mac_address)
            .map(|d| d.name.clone())
            .unwrap_or_else(|| utils::mac_address_human_name(mac_address))
    }

    /// Boards selected for the session, resolved from in-memory state only. Unlike
    /// `boards_system_view` this never touches the Bluetooth stack or the disk, so it is safe
    /// to call on every UI refetch. Sorted so the UI sees a stable order between refetches.
    fn session_boards(&self) -> Vec<NintendoDevice> {
        let mut boards: Vec<NintendoDevice> = self
            .session_settings
            .connections
            .keys()
            .map(|&mac_address| {
                match self
                    .known_devices
                    .iter()
                    .find(|d| d.mac_address == mac_address)
                {
                    Some(device) => NintendoDevice {
                        is_connected: true,
                        ..device.clone()
                    },
                    None => NintendoDevice {
                        id: utils::mac_address_human_name(mac_address),
                        name: utils::mac_address_human_name(mac_address),
                        mac_address,
                        is_connected: true,
                        last_connected: Some(Utc::now()),
                    },
                }
            })
            .collect();
        boards.sort_by(|a, b| a.name.cmp(&b.name).then(a.mac_address.cmp(&b.mac_address)));
        boards
    }

    fn connected_device_names(&self) -> HashMap<MacAddress, String> {
        self.session_settings
            .connections
            .keys()
            .map(|&mac_address| (mac_address, self.device_name(mac_address)))
            .collect()
    }

    // When we update the settings, it's simpler to restart every service to ensure that they are using
    // the latest configuration.
    async fn update_settings_and_restart_toolkit(
        &mut self,
        new_settings: GeneralSettings,
    ) -> Result<()> {
        let old_settings = &self.general_settings;
        let demo_mode_changed = old_settings.is_demo_mode != new_settings.is_demo_mode;

        if *old_settings == new_settings {
            return Ok(());
        }

        SettingsFileSystem::save_settings(&new_settings)?;
        self.general_settings = new_settings;

        if !demo_mode_changed {
            return Ok(());
        }

        // In the scenario where we changed the demo mode, we must restart the toolkit.
        // We must also discard any mock devices that were created.
        let non_mock_devices: Vec<NintendoDevice> = DeviceFileSystem::get_stored_devices()?
            .into_iter()
            .filter(|device| !device.is_demo_device())
            .collect();
        DeviceFileSystem::update_file_system_boards(&non_mock_devices)?;

        self.bluetooth_manager_tx =
            BluetoothService::start_bluetooth_handler(self.general_settings.is_demo_mode);
        self.session_settings.connections = HashMap::new();
        self.all_connections = HashMap::new();
        self.boards_system_view().await?;
        Ok(())
    }

    // Returns a list of both previous and connected devices.
    // If a device is found to be connected to the Operating System, but the manager doesn't know about it,
    // then the manager automatically connects to it.
    async fn boards_system_view(&mut self) -> Result<Vec<NintendoDevice>> {
        let (response_tx, response_rx) = oneshot::channel();
        self.bluetooth_manager_tx
            .send(BluetoothCommand::GetNintendoDevices {
                response: response_tx,
            })
            .await?;
        let mut nintendo_devices: Vec<NintendoDevice> =
            response_rx.await??.into_iter().map(|p| p.into()).collect();

        // Connect the manager to new missing devices.
        for device in &nintendo_devices {
            let mac_address = device.mac_address;
            let connection_exists = self.all_connections.contains_key(&mac_address);

            if device.is_connected && !connection_exists {
                self.connect(mac_address).await?;
            }
        }
        // Remove connections to any device that has been disconnected.
        self.all_connections.retain(|mac_address, _| {
            nintendo_devices
                .iter()
                .any(|device| device.mac_address == *mac_address && device.is_connected)
        });

        // Update name of devices and add any missing devices to the list.
        // Additionally, update the last connected date if the device is not connected.
        let stored_devices = DeviceFileSystem::get_stored_devices()?;
        for stored_device in stored_devices {
            let mac_address = stored_device.mac_address;
            let device = nintendo_devices
                .iter_mut()
                .find(|d| d.mac_address == mac_address);
            if let Some(device) = device {
                device.name = stored_device.name;
                if device.last_connected.is_none() {
                    device.last_connected = stored_device.last_connected;
                }
            } else {
                nintendo_devices.push(stored_device);
            }
        }

        DeviceFileSystem::update_file_system_boards(&nintendo_devices)?;
        self.known_devices = nintendo_devices.clone();

        Ok(nintendo_devices)
    }

    async fn connect(&mut self, mac_address: MacAddress) -> Result<()> {
        if self.all_connections.contains_key(&mac_address) {
            log::debug!("Device {:?} is already connected.", mac_address);
            return Ok(());
        }

        let connection_mode = if self.general_settings.is_demo_mode {
            BoardConnectionMode::Demo
        } else {
            BoardConnectionMode::Real
        };

        let board_connection = match balance_board_actor::initialize(mac_address, connection_mode) {
            Ok(connection) => connection,
            Err(e) => {
                let manager_tx = self.get_sender_channel();
                tokio::spawn(async move {
                    log::warn!(
                        "Failed to connect to device {:?}: {}. Trying again in 1 second.",
                        mac_address,
                        e
                    );
                    tokio::time::sleep(Duration::from_secs(1)).await;
                    // We use the BoardSystemView because it only tries to connect if the device actually exists in the bluetooth view.
                    let (tx, rx) = oneshot::channel();
                    let command = ToolkitCommand::GetBoardsSystemView { response: tx };
                    let _ = manager_tx.send(command).await;
                    let _ = rx.await;
                });

                return Ok(());
            }
        };
        self.all_connections.insert(mac_address, board_connection);
        match self
            .known_devices
            .iter_mut()
            .find(|d| d.mac_address == mac_address)
        {
            Some(device) => {
                device.is_connected = true;
                device.last_connected = Some(Utc::now());
            }
            // Boards paired through a scan reach here before any system view has run. The
            // placeholder is replaced by the next `boards_system_view`.
            None => self.known_devices.push(NintendoDevice {
                id: utils::mac_address_human_name(mac_address),
                name: NINTENDO_BOARD_ID.to_string(),
                mac_address,
                is_connected: true,
                last_connected: Some(Utc::now()),
            }),
        }
        self.response_tx
            .send(ToolkitResponse::NewDeviceFound(mac_address))
            .await?;

        Ok(())
    }

    // This is a long action, so we execute this in a background task
    fn identify_board(&self, mac_address: MacAddress) {
        let board = match self.all_connections.get(&mac_address) {
            Some(board) => board,
            None => {
                log::warn!(
                    "Attempted to identify a non-existent device: {:?}",
                    mac_address
                );
                return;
            }
        };

        let board_channel_clone = board.clone();
        tokio::spawn(async move {
            let result: Result<()> = async {
                board_channel_clone.send(BoardAction::TurnOffLed).await?;

                for _ in 0..10 {
                    board_channel_clone.send(BoardAction::TurnOnLed).await?;
                    tokio::time::sleep(Duration::from_millis(100)).await;
                    board_channel_clone.send(BoardAction::TurnOffLed).await?;
                    tokio::time::sleep(Duration::from_millis(100)).await;
                    board_channel_clone.send(BoardAction::TurnOnLed).await?;
                    tokio::time::sleep(Duration::from_millis(100)).await;
                    board_channel_clone.send(BoardAction::TurnOffLed).await?;
                    tokio::time::sleep(Duration::from_millis(800)).await;
                }

                board_channel_clone.send(BoardAction::TurnOnLed).await?;
                Ok(())
            }
            .await;

            if let Err(e) = result {
                log::error!("LED identification failed: {}", e);
            }
        });
    }

    async fn board_action(&self, mac_address: MacAddress, action: BoardAction) {
        let board = match self.all_connections.get(&mac_address) {
            Some(board) => board,
            None => {
                log::warn!(
                    "Attempted to send an action to a device that is not connected: {:?}",
                    mac_address
                );
                return;
            }
        };

        if let Err(e) = board.send(action).await {
            log::error!(
                "Failed to forward action to device {:?}: {}",
                mac_address,
                e
            );
        }
    }

    async fn submit_calibration(
        &mut self,
        mac_address: MacAddress,
        weight_kg: f64,
        readings: Vec<FrontendCapturedReading>,
    ) -> Result<DeviceCalibrationData, String> {
        // Stop any active calibration stream first
        self.stop_calibration_stream(mac_address).await;

        // Build calibration data from frontend readings
        let mut positions = HashMap::new();

        for captured in readings {
            let position = CalibrationPosition::from_str(&captured.position)
                .ok_or_else(|| format!("Invalid calibration position: {}", captured.position))?;

            // Convert timestamp from milliseconds to DateTime<Utc>
            let timestamp = chrono::DateTime::from_timestamp_millis(captured.reading.timestamp)
                .ok_or_else(|| format!("Invalid timestamp: {}", captured.reading.timestamp))?;

            let sensor_readings = BalanceBoardCalibratedReading {
                mac_address: captured.reading.mac_address,
                timestamp,
                top_left: captured.reading.top_left,
                top_right: captured.reading.top_right,
                bottom_left: captured.reading.bottom_left,
                bottom_right: captured.reading.bottom_right,
            };

            positions.insert(
                position.clone(),
                CalibrationPositionData {
                    position,
                    weight_kg,
                    sensor_readings,
                },
            );
        }

        let calibration_data = DeviceCalibrationData {
            mac_address,
            calibration_weight_kg: weight_kg,
            positions,
        };

        // Verify all 5 positions have been captured
        let required_positions = vec![
            CalibrationPosition::TopLeft,
            CalibrationPosition::TopRight,
            CalibrationPosition::BottomLeft,
            CalibrationPosition::BottomRight,
            CalibrationPosition::Center,
        ];

        for pos in &required_positions {
            if !calibration_data.positions.contains_key(pos) {
                return Err(format!("Missing calibration position: {:?}", pos));
            }
        }

        log::info!(
            "Calibration submitted for device {}: {} positions captured",
            mac_address,
            calibration_data.positions.len()
        );

        // TODO: Persist calibration data to file system or send to device
        // For now, we just return the calibration data
        // DeviceFileSystem::save_calibration_data(&calibration_data)?;

        Ok(calibration_data)
    }

    async fn start_calibration_stream(
        &mut self,
        mac_address: MacAddress,
        frontend_channel: Sender<BalanceBoardCalibratedReading>,
    ) {
        // Stop any existing stream for this device
        self.stop_calibration_stream(mac_address).await;

        // Get the board connection
        let board = match self.all_connections.get(&mac_address) {
            Some(board) => board.clone(),
            None => {
                log::warn!(
                    "Cannot start calibration stream: device {} not connected",
                    mac_address
                );
                return;
            }
        };

        // Create cancellation token
        let cancel_token = CancellationToken::new();
        self.active_calibration_streams
            .insert(mac_address, cancel_token.clone());

        // Create channel for raw data
        let (raw_data_tx, mut raw_data_rx) = mpsc::channel::<BalanceBoardCalibratedReading>(10);

        // Start recording on the board
        if let Err(e) = board.send(BoardAction::StartRecording(raw_data_tx)).await {
            log::error!("Failed to start calibration recording: {}", e);
            self.active_calibration_streams.remove(&mac_address);
            return;
        }

        let board_clone = board.clone();

        // Spawn task to forward data to frontend
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = cancel_token.cancelled() => {
                        log::debug!("Calibration stream cancelled for device {}", mac_address);
                        let _ = board_clone.send(BoardAction::StopRecording).await;
                        break;
                    }
                    Some(reading) = raw_data_rx.recv() => {
                        if frontend_channel.send(reading).await.is_err() {
                            log::debug!("Frontend channel closed, stopping calibration stream");
                            let _ = board_clone.send(BoardAction::StopRecording).await;
                            break;
                        }
                    }
                    else => {
                        log::debug!("Raw data channel closed");
                        break;
                    }
                }
            }
        });

        log::info!("Started calibration stream for device {}", mac_address);
    }

    async fn stop_calibration_stream(&mut self, mac_address: MacAddress) {
        if let Some(cancel_token) = self.active_calibration_streams.remove(&mac_address) {
            cancel_token.cancel();
            log::info!("Stopped calibration stream for device {}", mac_address);
        }
    }
}

// In a session, we have 2 producers:
//   - HID board - raw data
//   - Data processor - Processed data
// and 5 consumers:
//   - Data processor
//   - File writer
//   - LSL writer
//   - TCP writer
//   - Frontend observer
// Additionally, the number of observers and producers can vary based on the number of balance boards:
//   - HID Board - 1 thread per board
//   - Data processor - 1 thread per board
//   - File writer - 1 task per board
//   - LSL writer - 1 thread total
//   - TCP writer - 1 task total
//   - Frontend observer - 1 task total
//
// Each of the different consumers may be interested in receiving
// either or both the raw and processed data. (The Data Processor can only receive raw data).
// As such, we must keep track of who is interested in what, and in the end, create the correct channel
// connections.
#[derive(Clone, Debug)]
enum ObserverType {
    DataProcessor,
    FrontendObserver,
    FileWriter,
    TcpWriter,
    LslWriter,
}

#[derive(Debug)]
struct SessionMapping {
    mac_address: MacAddress,
    observers_raw: Vec<(ObserverType, Sender<BalanceBoardOutput>)>,
    observers_processed: Vec<(ObserverType, Sender<BalanceBoardOutput>)>,
}
async fn start_session(
    frontend_channel: Sender<BalanceBoardOutput>,
    general_settings: &GeneralSettings,
    session_settings: &CoreSessionConfiguration,
    connections: &HashMap<MacAddress, Sender<BoardAction>>,
    device_names: HashMap<MacAddress, String>,
) {
    let mut observer_list: Vec<SessionMapping> = vec![];
    for &mac_address in connections.keys() {
        observer_list.push(SessionMapping {
            mac_address,
            observers_raw: vec![],
            observers_processed: vec![],
        })
    }

    let processing_settings = ProcessingSettings {
        balance_board_x_size: general_settings.processing_settings.balance_board_x_size,
        balance_board_y_size: general_settings.processing_settings.balance_board_y_size,
        window_size_ms: session_settings.window_size_ms,
        window_slide_ms: session_settings.window_slide_ms,
        sampling_rate: session_settings.sampling_rate,
        interpolation: session_settings.interpolation.clone(),
        baseline_weight: session_settings.user.weight,
    };

    // 1 file writer
    // This file writer then spawns multiple different tasks
    let store_files = general_settings.store_raw_session || general_settings.store_processed_data;
    if store_files {
        let write_raw_files = general_settings.store_raw_session;
        let write_processed_files = general_settings.store_processed_data;

        let tx = file_writer::initialize(
            session_settings.clone(),
            device_names,
            write_raw_files,
            write_processed_files,
        );

        for session_mapping in observer_list.iter_mut() {
            add_observer_to_device_list(
                session_mapping,
                tx.clone(),
                ObserverType::FileWriter,
                write_raw_files,
                write_processed_files,
            );
        }
    }

    // 1 LSL Writer
    let should_use_lsl = session_settings.lsl_enabled
        && (general_settings.lsl_send_raw_data || general_settings.lsl_send_processed_data);
    if should_use_lsl {
        let config = LslConnectionSettings {
            stream_name: general_settings.lsl_stream_name.clone(),
            source_id: general_settings.lsl_source_id.clone(),
        };
        let tx = lsl_writer::initialize(config);
        for session_mapping in observer_list.iter_mut() {
            add_observer_to_device_list(
                session_mapping,
                tx.clone(),
                ObserverType::LslWriter,
                general_settings.lsl_send_raw_data,
                general_settings.lsl_send_processed_data,
            );
        }
    }

    // 1 TCP Writer
    let should_use_tcp = session_settings.tcp_enabled
        && (general_settings.tcp_send_raw_data || general_settings.tcp_send_processed_data);
    if should_use_tcp {
        let tx = tcp_writer::initialize(
            general_settings.tcp_connection_string_raw.clone(),
            general_settings.tcp_connection_string_processed.clone(),
        );
        for session_mapping in observer_list.iter_mut() {
            add_observer_to_device_list(
                session_mapping,
                tx.clone(),
                ObserverType::TcpWriter,
                general_settings.tcp_send_raw_data,
                general_settings.tcp_send_processed_data,
            );
        }
    };

    // 1 Frontend Observer
    for session_mapping in observer_list.iter_mut() {
        add_observer_to_device_list(
            session_mapping,
            frontend_channel.clone(),
            ObserverType::FrontendObserver,
            true,
            true,
        );
    }

    // N Data Processors (one per board)
    for device_mapping in observer_list.iter_mut() {
        let observers: Vec<Sender<BalanceBoardOutput>> = device_mapping
            .observers_processed
            .iter()
            .map(|(_, sender)| sender.clone())
            .collect();

        if !observers.is_empty() {
            let tx = data_processor::initialize(
                observers,
                device_mapping.mac_address,
                processing_settings.clone(),
            );
            device_mapping
                .observers_raw
                .push((ObserverType::DataProcessor, tx));
        }
    }

    for device_mapping in &observer_list {
        let observers: Vec<Sender<BalanceBoardOutput>> = device_mapping
            .observers_raw
            .iter()
            .map(|(_, sender)| sender.clone())
            .collect();

        if !observers.is_empty() {
            let (raw_data_tx, raw_data_rx) = mpsc::channel(10);
            let command = BoardAction::StartRecording(raw_data_tx);

            let Some(sender) = connections.get(&device_mapping.mac_address) else {
                continue;
            };
            if let Err(e) = sender.send(command).await {
                log::error!(
                    "Board {} is not accepting commands; it will not take part in this session: {e}",
                    utils::mac_address_human_name(device_mapping.mac_address)
                );
                continue;
            }
            initialize_raw_data_forwarder(raw_data_rx, observers);
        }
    }

    for device_mapping in observer_list {
        log::debug!(
            "Board {}: raw observers {:?}, processed observers {:?}",
            utils::mac_address_human_name(device_mapping.mac_address),
            device_mapping
                .observers_raw
                .iter()
                .map(|(observer_type, _)| observer_type)
                .collect::<Vec<_>>(),
            device_mapping
                .observers_processed
                .iter()
                .map(|(observer_type, _)| observer_type)
                .collect::<Vec<_>>(),
        );
    }
}

fn initialize_raw_data_forwarder(
    mut raw_data_rx: mpsc::Receiver<BalanceBoardCalibratedReading>,
    mut observers: Vec<Sender<BalanceBoardOutput>>,
) {
    tokio::spawn(async move {
        let mut warned_about_drops = false;
        while let Some(data) = raw_data_rx.recv().await {
            observers.retain(|observer| {
                match observer.try_send(BalanceBoardOutput::Raw(data.clone())) {
                    Ok(()) => true,
                    // The consumer is momentarily behind. Skipping one sample for it is far
                    // better than the alternative of evicting it for the rest of the session.
                    Err(TrySendError::Full(_)) => {
                        if !warned_about_drops {
                            warned_about_drops = true;
                            log::warn!(
                                "A raw data consumer is falling behind; dropping samples for it."
                            );
                        }
                        true
                    }
                    Err(TrySendError::Closed(_)) => false,
                }
            });

            if observers.is_empty() {
                break;
            }
        }
    });
}

fn add_observer_to_device_list(
    session_mapping: &mut SessionMapping,
    observer: Sender<BalanceBoardOutput>,
    observer_type: ObserverType,
    observe_raw_data: bool,
    observe_processed_data: bool,
) {
    if observe_raw_data {
        session_mapping
            .observers_raw
            .push((observer_type.clone(), observer.clone()));
    }
    if observe_processed_data {
        session_mapping
            .observers_processed
            .push((observer_type.clone(), observer.clone()));
    }
}
