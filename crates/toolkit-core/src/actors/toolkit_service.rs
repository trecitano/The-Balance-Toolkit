use crate::actors::balance_board_actor;
use crate::actors::balance_board_actor::{
    BalanceBoardCalibratedReading, BalanceBoardOutput, BoardAction, BoardConnectionMode,
};
use crate::actors::bluetooth_service::{BluetoothCommand, BluetoothService};
use crate::actors::state::activities::{Activity, ActivityState, TimelineBlock};
use crate::actors::state::users::UserState;
use crate::file_system::{DeviceFileSystem, ExistingSessionFileSystem, SettingsFileSystem};
use crate::processing::board_reader::ReaderFailure;
use crate::processing::data_processor::{InterpolationSetting, ProcessingSettings};
use crate::processing::lsl_writer::LslConnectionSettings;
use crate::processing::observers::broadcast;
use crate::processing::{data_processor, file_writer, lsl_writer, tcp_writer};
use crate::types::{
    CapturedCalibrationReading, GeneralSettings, LastSessionInformation, MacAddress,
    NintendoDevice, ReplayInformation, SelectedBoard, SessionActivityState, SessionInformation,
    SessionSettings, User, UserSummary,
};
use crate::{NINTENDO_BOARD_ID, utils};
use anyhow::{Result, anyhow};
use chrono::Utc;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc::Receiver;
use tokio::sync::mpsc::Sender;
use tokio::sync::{mpsc, oneshot};
use tokio_util::sync::CancellationToken;

#[cfg(test)]
#[path = "toolkit_service_tests.rs"]
mod tests;

/// A paired board whose HID node cannot be opened is retried with exponential backoff, at
/// most this many times per appearance in the Bluetooth view. Every explicit refresh still
/// makes one attempt of its own, so a user can always retry by hand.
const MAX_CONNECT_ATTEMPTS: u32 = 6;
const CONNECT_RETRY_BASE_DELAY: Duration = Duration::from_secs(1);
const CONNECT_RETRY_MAX_DELAY: Duration = Duration::from_secs(30);

/// Delay before connect attempt `attempt` (1-based): 1 s, 2 s, 4 s, … capped.
fn connect_retry_delay(attempt: u32) -> Duration {
    let factor = 2u32.saturating_pow(attempt.saturating_sub(1));
    CONNECT_RETRY_BASE_DELAY
        .saturating_mul(factor)
        .min(CONNECT_RETRY_MAX_DELAY)
}

/// Reconnect bookkeeping for one board, kept while it is visible but not connected.
#[derive(Debug, Default)]
struct ConnectRetry {
    /// Retries scheduled so far.
    attempts: u32,
    /// A retry timer is running; no second chain is started for the same board.
    scheduled: bool,
}

/// Calibration position identifier
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum CalibrationPosition {
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
    Center,
}

impl CalibrationPosition {
    /// Every position a complete calibration must cover.
    pub const ALL: [CalibrationPosition; 5] = [
        Self::TopLeft,
        Self::TopRight,
        Self::BottomLeft,
        Self::BottomRight,
        Self::Center,
    ];
}

/// Data captured at a single calibration position
#[derive(Debug, Clone)]
pub struct CalibrationPositionData {
    pub position: CalibrationPosition,
    pub weight_kg: f64,
    pub sensor_readings: BalanceBoardCalibratedReading,
}

/// Complete calibration data for a device
#[derive(Debug, Clone)]
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
    GetUsers {
        response: oneshot::Sender<Vec<Arc<User>>>,
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
        measurement_id: String,
        response: oneshot::Sender<Result<(), String>>,
    },
    StopWeightMeasurement {
        measurement_id: String,
        response: oneshot::Sender<Result<(), String>>,
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
        response: oneshot::Sender<Option<LastSessionInformation>>,
    },
    SessionInformation {
        response: oneshot::Sender<SessionInformation>,
    },
    UpdateSessionInformation {
        configuration: SessionSettings,
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
        response: oneshot::Sender<Option<ReplayInformation>>,
    },
    LoadReplayFile {
        file_path: PathBuf,
        response: oneshot::Sender<()>,
    },
    ClearReplay {
        response: oneshot::Sender<()>,
    },
    UpdateReplayInformation {
        configuration: SessionSettings,
        response: oneshot::Sender<()>,
    },
    StartReplay {
        frontend_channel: Sender<BalanceBoardOutput>,
        response: oneshot::Sender<()>,
    },
    StopReplay {
        response: oneshot::Sender<()>,
    },

    /// Internal timer command, tied to the run that scheduled it.
    AutoStop {
        target: SessionTarget,
        cancellation_token: CancellationToken,
    },
    /// Internal timer command: a board that could not be opened is due for another attempt.
    RetryConnect {
        mac_address: MacAddress,
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
        readings: Vec<CapturedCalibrationReading>,
        response: oneshot::Sender<Result<DeviceCalibrationData, String>>,
    },
}

pub enum ToolkitResponse {
    NewDeviceFound(MacAddress),
    /// The board's reader gave up (the board stopped answering); it is no longer connected
    /// and has been removed from the session.
    BoardDisconnected(MacAddress),
    SessionCompleted,
    ReplayCompleted,
    SessionStarted,
    SessionActivityChanged,
}

#[derive(Debug, Clone, Copy)]
pub enum SessionTarget {
    Session,
    Replay,
}

/// Owns a run's timer. Replacing or clearing the run cancels pending auto-stop work.
#[derive(Debug)]
pub struct RunningSession {
    started_at: chrono::DateTime<Utc>,
    cancellation_token: CancellationToken,
}

impl RunningSession {
    fn new(cancellation_token: CancellationToken) -> Self {
        Self {
            started_at: Utc::now(),
            cancellation_token,
        }
    }
}

impl Drop for RunningSession {
    fn drop(&mut self) {
        self.cancellation_token.cancel();
    }
}

struct WeightMeasurement {
    id: String,
    board: Sender<BoardAction>,
    task: tokio::task::JoinHandle<()>,
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
    known_devices: HashMap<MacAddress, NintendoDevice>,
    /// Tracks active calibration streams (mac_address -> cancellation flag)
    active_calibration_streams: HashMap<MacAddress, CancellationToken>,
    weight_measurement: Option<WeightMeasurement>,
    connect_retries: HashMap<MacAddress, ConnectRetry>,
    /// Reader threads report here when they give up on their board.
    reader_failure_tx: Sender<ReaderFailure>,
    reader_failure_rx: Receiver<ReaderFailure>,
}

pub struct SessionConfiguration {
    pub core: CoreSessionConfiguration,
    pub connections: HashMap<MacAddress, Sender<BoardAction>>,
    pub running: Option<RunningSession>,
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

impl CoreSessionConfiguration {
    /// Copies the pipeline settings a frontend may change. The user and the activity are
    /// resolved by the caller, since they need the user and activity state.
    pub fn apply(&mut self, configuration: &SessionSettings) {
        self.lsl_enabled = configuration.lsl_enabled;
        self.tcp_enabled = configuration.tcp_enabled;
        self.output_directory = configuration.output_directory.clone();
        self.window_size_ms = configuration.window_size_ms;
        self.window_slide_ms = configuration.window_slide_ms;
        self.sampling_rate = configuration.sampling_rate;
        self.interpolation = configuration.interpolation.clone();
    }
}

#[derive(Debug)]
pub struct ReplayConfiguration {
    pub core: CoreSessionConfiguration,
    pub file_path: PathBuf,
    pub device_names: HashMap<MacAddress, String>,
    pub connections: HashMap<MacAddress, Sender<BoardAction>>,
    pub replay_duration: Duration,
    pub running: Option<RunningSession>,
}

impl ConnectionManager {
    pub fn new(response_tx: Sender<ToolkitResponse>) -> Result<Self> {
        let (tx, rx) = mpsc::channel(100);
        let (reader_failure_tx, reader_failure_rx) = mpsc::channel(16);

        let activity_state = ActivityState::new()?;
        let user_state = UserState::new()?;

        let general_settings = SettingsFileSystem::get_or_create_default_settings()?;
        let known_devices = DeviceFileSystem::get_stored_devices()?
            .into_iter()
            .map(|device| (device.mac_address, device))
            .collect();
        let session_settings = SessionConfiguration {
            core: CoreSessionConfiguration {
                user: user_state.get_default_user()?,
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
            running: None,
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
            weight_measurement: None,
            connect_retries: HashMap::new(),
            reader_failure_tx,
            reader_failure_rx,
        })
    }

    pub fn get_sender_channel(&self) -> Sender<ToolkitCommand> {
        self.tx.clone()
    }

    pub async fn run(mut self) -> Result<()> {
        log::info!("Toolkit service started.");

        loop {
            tokio::select! {
                command = self.rx.recv() => {
                    let Some(command) = command else { break };
                    // A failing command must not take the whole manager (and with it every
                    // board connection) down: log it and keep serving the next one.
                    if let Err(e) = self.handle_command(command).await {
                        log::error!("Toolkit command failed: {e:#}");
                    }
                }
                Some(failure) = self.reader_failure_rx.recv() => {
                    if let Err(e) = self.board_reader_failed(failure).await {
                        log::error!("Failed to handle a board reader failure: {e:#}");
                    }
                }
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
                    self.known_devices.remove(&mac_address);
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
                measurement_id,
                response,
            } => {
                let result = self
                    .start_weight_measurement(mac_address, measurement_id, frontend_channel)
                    .await;
                let _ = response.send(result.map_err(|error| error.to_string()));
            }
            ToolkitCommand::StopWeightMeasurement {
                measurement_id,
                response,
            } => {
                let result = if self
                    .weight_measurement
                    .as_ref()
                    .is_some_and(|m| m.id == measurement_id)
                {
                    self.stop_weight_measurement().await
                } else {
                    Ok(())
                };
                let _ = response.send(result.map_err(|error| error.to_string()));
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
                if let Some(device) = self.known_devices.get_mut(&mac_address) {
                    device.name = device_name.clone();
                }
                DeviceFileSystem::update_board_name(mac_address, device_name)?
            }

            // Users
            ToolkitCommand::SelectUser { user_id } => {
                self.session_settings.core.user = self.user_state.get_user(user_id)?;
            }
            ToolkitCommand::GetUsers { response } => {
                let _ = response.send(self.user_state.get_users());
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
                // A session must not record under a user that no longer exists.
                if self.session_settings.core.user.id == user_id {
                    self.session_settings.core.user = self.user_state.get_default_user()?;
                }
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
                        let result = LastSessionInformation {
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

                let session_information = SessionInformation {
                    available_users: self
                        .user_state
                        .get_users()
                        .iter()
                        .map(|user| UserSummary::from(user.as_ref()))
                        .collect(),
                    selected_boards,
                    core: (&self.session_settings.core).into(),
                    activity: self.session_settings.core.activity.clone(),
                    has_ongoing_session: self.session_settings.running.is_some(),
                };
                let _ = response.send(session_information);
            }
            ToolkitCommand::UpdateSessionInformation {
                configuration,
                response,
            } => {
                self.session_settings.core.user =
                    self.user_state.get_user(configuration.selected_user)?;
                self.session_settings.core.apply(&configuration);

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
                // Finish the measurement before replacing the board's recording stream.
                // Later modal cleanup is scoped to its old measurement ID.
                self.stop_weight_measurement().await?;
                if let Some(activity) = &self.session_settings.core.activity {
                    self.session_settings.core.activity =
                        self.activity_state.get_copy_of_activity(&activity.id);
                }
                self.session_settings.core.user = self
                    .user_state
                    .get_user(self.session_settings.core.user.id)?;
                let cancellation_token = CancellationToken::new();
                self.session_settings.running =
                    Some(RunningSession::new(cancellation_token.clone()));
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
                    // If the session has an activity that starts with a tare, then perform the tare
                    if !activity.timeline_blocks.is_empty()
                        && activity.timeline_blocks[0].id == "tare"
                    {
                        for device in self.session_settings.connections.values() {
                            device.send(BoardAction::Tare).await?
                        }
                    }

                    // Stop the session when the activity ends
                    let duration = Duration::from_millis(activity.get_total_duration_ms() as u64);
                    self.spawn_auto_stop(duration, cancellation_token, SessionTarget::Session);
                }

                // Reply only once the session state is updated, so a refetch triggered by the
                // frontend after this command returns already sees the session as ongoing.
                let _ = response.send(());
            }
            ToolkitCommand::StopSession { response } => {
                self.stop_run(SessionTarget::Session).await?;
                let _ = response.send(());
            }
            ToolkitCommand::SessionActivityState { response } => {
                let Some(activity) = self.session_settings.core.activity.clone() else {
                    let _ = response.send(None);
                    return Ok(());
                };

                let ongoing_state = self
                    .session_settings
                    .running
                    .as_ref()
                    .and_then(|running| activity.state_at(Utc::now() - running.started_at));

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

                    // Replay readers are not watched: a broken file ends the replay on its
                    // own and there is no device to mark disconnected.
                    let tx = balance_board_actor::initialize(
                        *mac_address,
                        BoardConnectionMode::ReadFromFile(raw_file_path),
                        None,
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
                    running: None,
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
                // The replay keeps the user recorded in the file; only the pipeline
                // settings are adjustable.
                if let Some(settings) = self.replay_settings.as_mut() {
                    settings.core.apply(&configuration);
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

                    // Stop the replay when the recording ends
                    let cancellation_token = CancellationToken::new();
                    settings.running = Some(RunningSession::new(cancellation_token.clone()));
                    let duration = settings.replay_duration;
                    self.spawn_auto_stop(duration, cancellation_token, SessionTarget::Replay);
                }

                let _ = response.send(());
            }
            ToolkitCommand::StopReplay { response } => {
                self.stop_run(SessionTarget::Replay).await?;
                let _ = response.send(());
            }

            ToolkitCommand::AutoStop {
                target,
                cancellation_token,
            } => {
                // A timer can already be queued when a manual stop/restart happens.
                if !cancellation_token.is_cancelled() {
                    self.stop_run(target).await?;
                }
            }
            ToolkitCommand::RetryConnect { mac_address } => {
                if let Some(retry) = self.connect_retries.get_mut(&mac_address) {
                    retry.scheduled = false;
                }
                // The system view only connects boards that are still present and, when
                // the attempt fails again, schedules the next retry.
                self.boards_system_view().await?;
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

    async fn start_weight_measurement(
        &mut self,
        mac_address: MacAddress,
        measurement_id: String,
        frontend_channel: Sender<f64>,
    ) -> Result<()> {
        if self.session_settings.running.is_some() {
            anyhow::bail!("Stop the session before measuring weight");
        }
        if self.weight_measurement.is_some() {
            anyhow::bail!("A weight measurement is already running");
        }
        if self.active_calibration_streams.contains_key(&mac_address) {
            anyhow::bail!("Finish calibration before measuring weight");
        }
        let board = self
            .session_settings
            .connections
            .get(&mac_address)
            .ok_or_else(|| anyhow!("Select a connected board before measuring weight"))?
            .clone();
        let (raw_data_tx, mut raw_data_rx) = mpsc::channel(10);
        board.send(BoardAction::StartRecording(raw_data_tx)).await?;
        let manager = self.tx.clone();
        let id = measurement_id.clone();
        let task = tokio::spawn(async move {
            while let Some(data) = raw_data_rx.recv().await {
                let weight = data.top_left + data.top_right + data.bottom_left + data.bottom_right;
                if frontend_channel.send(weight as f64).await.is_err() {
                    break;
                }
            }
            // Only the manager stops boards, so a late stream closure cannot stop
            // a session or another measurement that has since taken ownership.
            let (response, _) = oneshot::channel();
            let _ = manager
                .send(ToolkitCommand::StopWeightMeasurement {
                    measurement_id: id,
                    response,
                })
                .await;
        });
        self.weight_measurement = Some(WeightMeasurement {
            id: measurement_id,
            board,
            task,
        });
        Ok(())
    }

    async fn stop_weight_measurement(&mut self) -> Result<()> {
        if let Some(measurement) = self.weight_measurement.take() {
            measurement.task.abort();
            let _ = measurement.task.await;
            // A disconnected board has already stopped producing readings.
            let _ = measurement.board.send(BoardAction::StopRecording).await;
        }
        Ok(())
    }

    async fn stop_run(&mut self, target: SessionTarget) -> Result<()> {
        let (running, connections, completed) = match target {
            SessionTarget::Session => (
                &mut self.session_settings.running,
                &self.session_settings.connections,
                ToolkitResponse::SessionCompleted,
            ),
            SessionTarget::Replay => {
                let Some(settings) = self.replay_settings.as_mut() else {
                    return Ok(());
                };
                (
                    &mut settings.running,
                    &settings.connections,
                    ToolkitResponse::ReplayCompleted,
                )
            }
        };
        let was_running = running.is_some();
        stop_running(running, connections).await?;
        if was_running {
            self.response_tx.send(completed).await?;
        }
        Ok(())
    }

    fn spawn_auto_stop(
        &self,
        duration: Duration,
        cancellation_token: CancellationToken,
        target: SessionTarget,
    ) {
        tokio::spawn(auto_stop(
            duration,
            cancellation_token,
            target,
            self.get_sender_channel(),
        ));
    }

    /// Name of a board as the user knows it, from the device cache or the MAC address.
    fn device_name(&self, mac_address: MacAddress) -> String {
        self.known_devices
            .get(&mac_address)
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
            .map(|&mac_address| match self.known_devices.get(&mac_address) {
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
        self.connect_retries.clear();
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
        // Remove connections to any device that has been disconnected. A board that left
        // the Bluetooth view also gets a fresh retry budget for when it comes back.
        let is_present = |mac_address: &MacAddress| {
            nintendo_devices
                .iter()
                .any(|device| device.mac_address == *mac_address && device.is_connected)
        };
        self.all_connections
            .retain(|mac_address, _| is_present(mac_address));
        self.connect_retries
            .retain(|mac_address, _| is_present(mac_address));

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
        self.known_devices = nintendo_devices
            .iter()
            .map(|device| (device.mac_address, device.clone()))
            .collect();

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

        let board_connection = match balance_board_actor::initialize(
            mac_address,
            connection_mode,
            Some(self.reader_failure_tx.clone()),
        ) {
            Ok(connection) => connection,
            Err(e) => {
                self.schedule_connect_retry(mac_address, e);
                return Ok(());
            }
        };
        self.connect_retries.remove(&mac_address);
        self.all_connections.insert(mac_address, board_connection);
        // Boards paired through a scan reach here before any system view has run. The
        // placeholder is replaced by the next `boards_system_view`.
        let device = self
            .known_devices
            .entry(mac_address)
            .or_insert_with(|| NintendoDevice {
                id: utils::mac_address_human_name(mac_address),
                name: NINTENDO_BOARD_ID.to_string(),
                mac_address,
                is_connected: false,
                last_connected: None,
            });
        device.is_connected = true;
        device.last_connected = Some(Utc::now());
        self.response_tx
            .send(ToolkitResponse::NewDeviceFound(mac_address))
            .await?;

        Ok(())
    }

    /// Queues one more connect attempt for a board that could not be opened. At most one
    /// timer runs per board, however many refreshes hit the failure, and the chain ends
    /// after `MAX_CONNECT_ATTEMPTS`.
    fn schedule_connect_retry(&mut self, mac_address: MacAddress, error: anyhow::Error) {
        let name = utils::mac_address_human_name(mac_address);
        let retry = self.connect_retries.entry(mac_address).or_default();
        if retry.scheduled {
            log::debug!("Failed to connect to {name}: {error:#}. A retry is already scheduled.");
            return;
        }
        if retry.attempts >= MAX_CONNECT_ATTEMPTS {
            log::warn!(
                "Failed to connect to {name}: {error:#}. Gave up after {MAX_CONNECT_ATTEMPTS} retries; refresh the devices to try again."
            );
            return;
        }

        retry.attempts += 1;
        retry.scheduled = true;
        let delay = connect_retry_delay(retry.attempts);
        log::warn!(
            "Failed to connect to {name}: {error:#}. Retrying in {delay:?} ({}/{MAX_CONNECT_ATTEMPTS}).",
            retry.attempts
        );

        let manager_tx = self.get_sender_channel();
        tokio::spawn(async move {
            tokio::time::sleep(delay).await;
            let _ = manager_tx
                .send(ToolkitCommand::RetryConnect { mac_address })
                .await;
        });
    }

    /// A reader thread gave up on its board. Forget the connection so the board shows as
    /// disconnected and a session stop no longer trips over a dead channel, then tell the
    /// frontend. Reports from a reader that was already replaced are ignored.
    async fn board_reader_failed(&mut self, failure: ReaderFailure) -> Result<()> {
        let ReaderFailure { mac_address, error } = failure;
        let name = utils::mac_address_human_name(mac_address);
        let is_current = self
            .all_connections
            .get(&mac_address)
            .is_some_and(|connection| connection.is_closed());
        if !is_current {
            log::debug!("Ignoring a failure from a replaced reader for {name}: {error:#}");
            return Ok(());
        }

        log::error!("Board {name} stopped responding and was disconnected: {error:#}");
        self.all_connections.remove(&mac_address);
        self.session_settings.connections.remove(&mac_address);
        if let Some(device) = self.known_devices.get_mut(&mac_address) {
            device.is_connected = false;
        }
        self.response_tx
            .send(ToolkitResponse::BoardDisconnected(mac_address))
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
        readings: Vec<CapturedCalibrationReading>,
    ) -> Result<DeviceCalibrationData, String> {
        // Stop any active calibration stream first
        self.stop_calibration_stream(mac_address).await;

        // Build calibration data from frontend readings
        let mut positions = HashMap::new();

        for captured in readings {
            positions.insert(
                captured.position.clone(),
                CalibrationPositionData {
                    position: captured.position,
                    weight_kg,
                    sensor_readings: captured.reading,
                },
            );
        }

        if let Some(missing) = CalibrationPosition::ALL
            .iter()
            .find(|position| !positions.contains_key(position))
        {
            return Err(format!("Missing calibration position: {missing:?}"));
        }

        let calibration_data = DeviceCalibrationData {
            mac_address,
            calibration_weight_kg: weight_kg,
            positions,
        };

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
        // Finish measurement ownership before calibration replaces the board stream.
        let _ = self.stop_weight_measurement().await;
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
#[derive(Debug)]
struct SessionMapping {
    mac_address: MacAddress,
    observers_raw: Vec<Sender<BalanceBoardOutput>>,
    observers_processed: Vec<Sender<BalanceBoardOutput>>,
}

/// Subscribes `observer` to every board's raw and/or processed data.
fn attach_observer(
    observer_list: &mut [SessionMapping],
    observer: &Sender<BalanceBoardOutput>,
    observe_raw_data: bool,
    observe_processed_data: bool,
) {
    for mapping in observer_list.iter_mut() {
        if observe_raw_data {
            mapping.observers_raw.push(observer.clone());
        }
        if observe_processed_data {
            mapping.observers_processed.push(observer.clone());
        }
    }
}

/// Sends `StopRecording` to every board, which closes the recording channels and lets the
/// pipeline behind them drain and finish.
async fn stop_boards(connections: &HashMap<MacAddress, Sender<BoardAction>>) -> Result<()> {
    for board in connections.values() {
        board.send(BoardAction::StopRecording).await?;
    }
    Ok(())
}

async fn stop_running(
    running: &mut Option<RunningSession>,
    connections: &HashMap<MacAddress, Sender<BoardAction>>,
) -> Result<()> {
    // Cancel even if a disconnected board rejects the stop command.
    running.take();
    stop_boards(connections).await
}

/// Timers request a stop; only the manager stopping the current run emits completion.
async fn auto_stop(
    duration: Duration,
    cancellation_token: CancellationToken,
    target: SessionTarget,
    manager_tx: Sender<ToolkitCommand>,
) {
    tokio::select! {
        biased;
        _ = cancellation_token.cancelled() => {}
        _ = tokio::time::sleep(duration) => {
            let _ = manager_tx.send(ToolkitCommand::AutoStop {
                target,
                cancellation_token,
            }).await;
        }
    }
}

async fn start_session(
    frontend_channel: Sender<BalanceBoardOutput>,
    general_settings: &GeneralSettings,
    session_settings: &CoreSessionConfiguration,
    connections: &HashMap<MacAddress, Sender<BoardAction>>,
    device_names: HashMap<MacAddress, String>,
) {
    let mut observer_list: Vec<SessionMapping> = connections
        .keys()
        .map(|&mac_address| SessionMapping {
            mac_address,
            observers_raw: vec![],
            observers_processed: vec![],
        })
        .collect();

    let processing_settings = ProcessingSettings {
        balance_board_x_size: general_settings.processing_settings.balance_board_x_size,
        balance_board_y_size: general_settings.processing_settings.balance_board_y_size,
        window_size_ms: session_settings.window_size_ms,
        window_slide_ms: session_settings.window_slide_ms,
        sampling_rate: session_settings.sampling_rate,
        interpolation: session_settings.interpolation.clone(),
        baseline_weight: session_settings.user.weight,
    };

    // 1 file writer, which spawns one task per board
    let write_raw_files = general_settings.store_raw_session;
    let write_processed_files = general_settings.store_processed_data;
    if write_raw_files || write_processed_files {
        let tx = file_writer::initialize(
            session_settings.clone(),
            device_names,
            write_raw_files,
            write_processed_files,
        );
        attach_observer(
            &mut observer_list,
            &tx,
            write_raw_files,
            write_processed_files,
        );
    }

    // 1 LSL writer
    let lsl_raw = general_settings.lsl_send_raw_data;
    let lsl_processed = general_settings.lsl_send_processed_data;
    if session_settings.lsl_enabled && (lsl_raw || lsl_processed) {
        let tx = lsl_writer::initialize(LslConnectionSettings {
            stream_name: general_settings.lsl_stream_name.clone(),
            source_id: general_settings.lsl_source_id.clone(),
        });
        attach_observer(&mut observer_list, &tx, lsl_raw, lsl_processed);
    }

    // 1 TCP writer
    let tcp_raw = general_settings.tcp_send_raw_data;
    let tcp_processed = general_settings.tcp_send_processed_data;
    if session_settings.tcp_enabled && (tcp_raw || tcp_processed) {
        let tx = tcp_writer::initialize(
            general_settings.tcp_connection_string_raw.clone(),
            general_settings.tcp_connection_string_processed.clone(),
        );
        attach_observer(&mut observer_list, &tx, tcp_raw, tcp_processed);
    }

    // 1 frontend observer
    attach_observer(&mut observer_list, &frontend_channel, true, true);

    // N data processors (one per board), feeding the processed observers
    for mapping in observer_list.iter_mut() {
        if !mapping.observers_processed.is_empty() {
            let tx = data_processor::initialize(
                mapping.observers_processed.clone(),
                mapping.mac_address,
                processing_settings.clone(),
            );
            mapping.observers_raw.push(tx);
        }
    }

    for mapping in observer_list {
        log::debug!(
            "Board {}: {} raw observers, {} processed observers",
            utils::mac_address_human_name(mapping.mac_address),
            mapping.observers_raw.len(),
            mapping.observers_processed.len(),
        );
        if mapping.observers_raw.is_empty() {
            continue;
        }
        let Some(board) = connections.get(&mapping.mac_address) else {
            continue;
        };

        let (raw_data_tx, raw_data_rx) = mpsc::channel(10);
        if let Err(e) = board.send(BoardAction::StartRecording(raw_data_tx)).await {
            log::error!(
                "Board {} is not accepting commands; it will not take part in this session: {e}",
                utils::mac_address_human_name(mapping.mac_address)
            );
            continue;
        }
        initialize_raw_data_forwarder(raw_data_rx, mapping.observers_raw);
    }
}

fn initialize_raw_data_forwarder(
    mut raw_data_rx: mpsc::Receiver<BalanceBoardCalibratedReading>,
    mut observers: Vec<Sender<BalanceBoardOutput>>,
) {
    tokio::spawn(async move {
        let mut warned_about_drops = false;
        while let Some(data) = raw_data_rx.recv().await {
            broadcast(
                &mut observers,
                BalanceBoardOutput::Raw(data),
                &mut warned_about_drops,
            );

            if observers.is_empty() {
                break;
            }
        }
    });
}
