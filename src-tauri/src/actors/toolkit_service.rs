use std::collections::{HashMap, HashSet};
use std::time::Duration;
use tokio::sync::{mpsc, oneshot};
use crate::actors::balance_board_actor::{BalanceBoardCalibratedReading, BalanceBoardOutput, BoardAction};
use crate::actors::bluetooth_service::{BluetoothCommand, BluetoothService};
use crate::file_system::{DeviceFileSystem, SettingsFileSystem};
use crate::types::{GeneralSettings, MacAddress, NintendoDevice, SelectedBoard, SessionInformation};
use anyhow::Result;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc::Sender;
use file_system::UserFileSystem;
use crate::actors::balance_board_actor;
use crate::actors::state::activities::{Activity, ActivityState};
use crate::file_system;
use crate::processing::{data_processor, file_writer, lsl_writer, tcp_writer};
use crate::processing::data_processor::{InterpolationSetting, ProcessingSettings};
use crate::processing::lsl_writer::LslConnectionSettings;

// Commands that can be sent to the ConnectionManager
#[derive(Debug)]
pub enum ToolkitCommand {
    GetSettings { response: oneshot::Sender<GeneralSettings> },
    SaveSettings { settings: GeneralSettings, response: oneshot::Sender<bool> },

    // Manager main actions
    BluetoothAction(BluetoothCommand),

    GetBoardsSystemView {
        responder: oneshot::Sender<Vec<NintendoDevice>>,
    },

    Connect {
        mac_address: MacAddress,
        response: oneshot::Sender<bool>,
    },
    IdentifyBoard {
        mac_address: MacAddress,
    },
    UpdateBoardName {
        mac_address: MacAddress,
        device_name: String,
    },

    SelectUser {
        user_name: String,
    },
    GetSelectedUser {
        response: oneshot::Sender<String>
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

    SessionInformation {
        response: oneshot::Sender<SessionInformation>,
    },
    UpdateSessionInformation {
        session_configuration: SessionConfiguration,
    },
    StartSession {
        frontend_channel: Sender<BalanceBoardOutput>
    },
    StopSession,

    BoardAction {
        mac_address: MacAddress,
        action: BoardAction,
    },
}

pub enum ToolkitResponse {
    NewDeviceFound(NintendoDevice),
}

pub struct ConnectionManager {
    rx: mpsc::Receiver<ToolkitCommand>,
    tx: Sender<ToolkitResponse>,
    bluetooth_manager_tx: Sender<BluetoothCommand>,
    activity_state: ActivityState,

    general_settings: GeneralSettings,
    session_settings: SessionConfiguration,
    connections: HashMap<MacAddress, Sender<BoardAction>>,
    selected_boards: HashSet<MacAddress>,
    has_ongoing_session: bool,
}

// TODO The activity_id for now is just the string ID in the frontend, since the activities are fully implemented
// in the frontend. In near future, they should be implemented in the backend.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionConfiguration {
    pub selected_user: String,
    pub lsl_enabled: bool,
    pub tcp_enabled: bool,
    pub output_directory: String,
    pub window_size_ms: u64,
    pub window_slide_ms: u64,
    pub sampling_rate: u64,
    pub interpolation: InterpolationSetting,
    pub activity_id: Option<String>,
}

impl ConnectionManager {
    pub fn new(rx: mpsc::Receiver<ToolkitCommand>, tx: Sender<ToolkitResponse>) -> Result<Self> {
        let selected_user = UserFileSystem::get_or_create_default_user()?.name;
        let general_settings = SettingsFileSystem::get_or_create_default_settings()?;
        let session_settings = SessionConfiguration {
            selected_user: selected_user.clone(),
            lsl_enabled: false,
            tcp_enabled: false,
            output_directory: general_settings.store_files_default_directory.clone(),
            window_size_ms: general_settings.processing_settings.window_size_ms,
            window_slide_ms: general_settings.processing_settings.window_slide_ms,
            sampling_rate: general_settings.processing_settings.sampling_rate,
            interpolation: general_settings.processing_settings.interpolation.clone(),
            activity_id: None
        };
        let activity_state = ActivityState::new()?;

        Ok(Self {
            rx,
            tx,
            bluetooth_manager_tx: BluetoothService::start_bluetooth_handler(general_settings.is_demo_mode),
            activity_state,

            general_settings,
            session_settings,
            connections: HashMap::new(),
            selected_boards: HashSet::new(),
            has_ongoing_session: false,
        })
    }

    pub async fn run(mut self) -> Result<()> {
        println!("Balance Walker Service started.");
        
        while let Some(command) = self.rx.recv().await {
            match command {
                ToolkitCommand::GetSettings { response  } => {
                    response.send(self.general_settings.clone()).unwrap();
                }
                ToolkitCommand::SaveSettings { settings, response } => {
                    self.update_settings_and_restart_toolkit(settings).await?;
                    response.send(true).unwrap();
                }

                ToolkitCommand::BluetoothAction(action) => {
                    self.bluetooth_manager_tx.send(action).await?;
                }
                ToolkitCommand::GetBoardsSystemView { responder } => {
                    let result = self.boards_system_view().await?;
                    responder.send(result).unwrap();
                }

                ToolkitCommand::Connect { mac_address, response } => {
                    self.connect(mac_address).await?;
                    response.send(true).unwrap();
                }
                ToolkitCommand::IdentifyBoard { mac_address } => {
                    self.identify_board(mac_address);
                }
                ToolkitCommand::UpdateBoardName { mac_address, device_name } => {
                    DeviceFileSystem::update_board_name(mac_address, device_name)?
                }

                ToolkitCommand::SelectUser { user_name } => {
                    self.session_settings.selected_user = user_name;
                }
                ToolkitCommand::GetSelectedUser { response } => {
                    response.send(self.session_settings.selected_user.clone()).unwrap();
                }
                ToolkitCommand::SelectBoardForSession { mac_address } => {
                    self.selected_boards.insert(mac_address);
                }
                ToolkitCommand::UnselectBoardForSession { mac_address } => {
                    self.selected_boards.remove(&mac_address);
                }
                ToolkitCommand::SelectedBoardsForSession { response } => {
                    response.send(self.selected_boards.iter().cloned().collect()).unwrap();
                }

                ToolkitCommand::GetActivities { response } => {
                    let activities = self.activity_state.get_copy_of_activities();
                    response.send(activities).unwrap();
                }
                ToolkitCommand::GetActivity { activity_id, response } => {
                    let activity = self.activity_state.get_copy_of_activity(&activity_id);
                    response.send(activity).unwrap();
                }
                ToolkitCommand::UpdateActivity { activity, response } => {
                    self.activity_state.update_activity(activity)?;

                    if let Some(response) = response {
                        response.send(()).unwrap();
                    }
                }

                ToolkitCommand::SessionInformation { response } => {
                    let selected_boards = self.boards_system_view().await?
                        .iter()
                        .filter(|device| {
                            // Convert u64 to MacAddress before checking
                            let mac = MacAddress::from(device.mac_address);
                            self.selected_boards.contains(&mac)
                        })
                        .map(|device| SelectedBoard {
                            name: device.name.clone(),
                            mac_address: MacAddress::from(device.mac_address),
                        })
                        .collect();

                    let session_information = SessionInformation {
                        available_users: UserFileSystem::get_users()?.into_iter().map(|user| user.name).collect(),
                        selected_boards,
                        has_ongoing_session: self.has_ongoing_session,
                        session_configuration: SessionConfiguration {
                            selected_user: self.session_settings.selected_user.clone(),
                            lsl_enabled: self.session_settings.lsl_enabled,
                            tcp_enabled: self.session_settings.tcp_enabled,
                            output_directory: self.session_settings.output_directory.clone(),
                            window_size_ms: self.session_settings.window_size_ms,
                            window_slide_ms: self.session_settings.window_slide_ms,
                            sampling_rate: self.session_settings.sampling_rate,
                            interpolation: self.session_settings.interpolation.clone(),
                            activity_id: self.session_settings.activity_id.clone()
                        }
                    };
                    response.send(session_information).unwrap();
                }
                ToolkitCommand::UpdateSessionInformation { session_configuration } => {
                    self.session_settings = SessionConfiguration {
                        selected_user: session_configuration.selected_user,
                        lsl_enabled: session_configuration.lsl_enabled,
                        tcp_enabled: session_configuration.tcp_enabled,
                        output_directory: session_configuration.output_directory,
                        window_size_ms: session_configuration.window_size_ms,
                        window_slide_ms: session_configuration.window_slide_ms,
                        sampling_rate: session_configuration.sampling_rate,
                        interpolation: session_configuration.interpolation,
                        activity_id: session_configuration.activity_id
                    };
                }
                ToolkitCommand::StartSession { frontend_channel } => {
                    self.has_ongoing_session = true;
                    start_session(frontend_channel,
                                  &self.general_settings,
                                  &self.session_settings,
                                  &self.selected_boards,
                                  &self.connections)
                        .await;
                },
                ToolkitCommand::StopSession => {
                    for board in &self.selected_boards {
                        match &self.connections.get(board) {
                            Some(connection) => {
                                let command = { BoardAction::StopRecording };
                                connection.send(command).await?
                            }
                            None => ()
                        }
                    }
                    self.has_ongoing_session = false;
                }


                ToolkitCommand::BoardAction { mac_address, action } => {
                    self.board_action(mac_address, action).await;
                }
            }
        }
        
        println!("Balance Walker Service stopped.");
        Ok(())
    }

    // When we update the settings, it's simpler to restart every service to ensure that they are using
    // the latest configuration.
    async fn update_settings_and_restart_toolkit(&mut self, new_settings: GeneralSettings) -> Result<()> {
        let old_settings = &self.general_settings;
        println!("Updating settings: {:?}", new_settings);
        println!("old settings: {:?}", self.general_settings);
        let demo_mode_changed = old_settings.is_demo_mode != new_settings.is_demo_mode;
        println!("demo mode changed: {:?}", demo_mode_changed);

        if *old_settings == new_settings {
            return Ok(())
        }

        SettingsFileSystem::save_settings(&new_settings)?;
        self.general_settings = new_settings;

        if !demo_mode_changed {
            return Ok(())
        }

        // In the scenario where we changed the demo mode, we must restart the toolkit.
        // We must also discard any mock devices that were created.
        let non_mock_devices = DeviceFileSystem::get_stored_devices()?.into_iter().filter(|device| !device.is_demo_device()).collect();
        DeviceFileSystem::update_file_system_boards(&non_mock_devices)?;

        self.bluetooth_manager_tx = BluetoothService::start_bluetooth_handler(self.general_settings.is_demo_mode);
        self.connections = HashMap::new();
        self.selected_boards = HashSet::new();
        self.boards_system_view().await?;
        Ok(())
    }


    // Returns a list of both previous and connected devices.
    // If a device is found to be connected to the Operating System, but the manager doesn't know about it,
    // then the manager automatically connects to it.
    async fn boards_system_view(&mut self) -> Result<Vec<NintendoDevice>> {
        let stored_devices = DeviceFileSystem::get_stored_devices()?;
        
        let (response_tx, response_rx) = oneshot::channel();
        self.bluetooth_manager_tx.send(BluetoothCommand::GetNintendoDevices { response: response_tx }).await?;
        let bluetooth_devices = response_rx.await?;

        // Connect the manager to any missing devices.
        for device in &bluetooth_devices {
            let mac_address = device.mac_address;
            if !self.connections.contains_key(&mac_address) {
                self.connect(mac_address).await;
            }
        }

        let os_connected_devices: Vec<NintendoDevice> = bluetooth_devices
            .into_iter()
            .map(|p| p.into())
            .collect();

        let mut result = stored_devices;
        for device in os_connected_devices {
            if let Some(found) = result.iter_mut().find(|d| d.mac_address == device.mac_address) {
                found.last_connected = None; // Or update with new connection time
            } else {
                result.push(device);
            }
        }

        DeviceFileSystem::update_file_system_boards(&result);

        Ok(result)
    }

    async fn connect(&mut self, mac_address: MacAddress) -> Result<()> {
        if self.connections.contains_key(&mac_address) {
            println!("Device {:?} is already connected.", mac_address);
            return Ok(());
        }

        println!("Connecting to device: {:?}", mac_address);
        let board_connection = balance_board_actor::initialize(mac_address, self.general_settings.is_demo_mode)?;

        self.connections.insert(mac_address, board_connection);
        // TODO
        //self.tx.send(ToolkitResponse::NewDeviceFound())
        Ok(())
    }

    // This is a long action, so we execute this in a background task
    fn identify_board(&self, mac_address: MacAddress) {
        let board = match self.connections.get(&mac_address) {
            Some(board) => board,
            None => {
                eprintln!("Attempted to identify a non-existent device: {:?}", mac_address);
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
            }.await;

            if let Err(e) = result {
                eprintln!("LED identification failed: {}", e);
            }
        });
    }

    async fn board_action(&self, mac_address: MacAddress, action: BoardAction) {
        let board = match self.connections.get(&mac_address) {
            Some(board) => board,
            None => {
                eprintln!("Attempted to identify a non-existent device: {:?}", mac_address);
                return;
            }
        };

        if let Err(e) = board.send(action).await {
            eprintln!("Failed to forward action to device {:?}: {}", mac_address, e);
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

struct SessionMapping {
    mac_address: MacAddress,
    observers_raw: Vec<(ObserverType, Sender<BalanceBoardOutput>)>,
    observers_processed: Vec<(ObserverType, Sender<BalanceBoardOutput>)>,
}
async fn start_session(frontend_channel: Sender<BalanceBoardOutput>,
                       general_settings: &GeneralSettings,
                       session_settings: &SessionConfiguration,
                       selected_boards: &HashSet<MacAddress>,
                       hid_board_rx_map: &HashMap<MacAddress, Sender<BoardAction>>) {
    if selected_boards.len() == 0 {
        return;
    }

    let mut observer_list: Vec<SessionMapping> = vec!();
    for mac_address in selected_boards {
        observer_list.push(SessionMapping {
            mac_address: *mac_address,
            observers_raw: vec!(),
            observers_processed: vec!(),
        })
    }

    let processing_settings = ProcessingSettings {
        balance_board_x_size: general_settings.processing_settings.balance_board_x_size,
        balance_board_y_size: general_settings.processing_settings.balance_board_y_size,
        window_size_ms: session_settings.window_size_ms,
        window_slide_ms: session_settings.window_slide_ms,
        sampling_rate: session_settings.sampling_rate,
        interpolation: session_settings.interpolation.clone()
    };

    // N file writers (one per board)
    let store_files = general_settings.store_raw_session || general_settings.store_processed_data;
    if store_files {
        for mut session_mapping in observer_list.iter_mut() {
            let output_directory = session_settings.output_directory.clone();
            let session_name = Utc::now().format("%Y-%m-%dT%H-%M-%SZ").to_string();

            let tx = file_writer::initialize(
                output_directory,
                session_name,
                general_settings.store_raw_session,
                general_settings.store_processed_data,
                "TODO_UPDATE_SESSION_DEVICE_NAME".to_string(),
                processing_settings.clone()
            );
            add_observer_to_device_list(&mut session_mapping,
                                        tx,
                                        ObserverType::FileWriter,
                                        general_settings.store_raw_session,
                                        general_settings.store_processed_data,
                                        );
        }
    }

    // 1 LSL Writer
    let should_use_lsl = session_settings.lsl_enabled &&
        (general_settings.lsl_send_raw_data || general_settings.lsl_send_processed_data);
    if should_use_lsl {
        let config = LslConnectionSettings {
            stream_name: general_settings.lsl_stream_name.clone(),
            source_id: general_settings.lsl_source_id.clone()
        };
        let tx = lsl_writer::initialize(config);
        for mut session_mapping in observer_list.iter_mut() {
            add_observer_to_device_list(&mut session_mapping,
                                        tx.clone(),
                                        ObserverType::LslWriter,
                                        general_settings.lsl_send_raw_data,
                                        general_settings.lsl_send_processed_data);
        }
    }

    // 1 TCP Writer
    let should_use_tcp = session_settings.tcp_enabled &&
        (general_settings.tcp_send_raw_data || general_settings.tcp_send_processed_data);
    if should_use_tcp {
        let tx = tcp_writer::initialize(general_settings.tcp_connection_string.clone());
        for mut session_mapping in observer_list.iter_mut() {
            add_observer_to_device_list(&mut session_mapping,
                                        tx.clone(),
                                        ObserverType::TcpWriter,
                                        general_settings.tcp_send_raw_data,
                                        general_settings.tcp_send_processed_data);
        }
    };

    // 1 Frontend Observer
    let tx = initialize_frontend_observer(frontend_channel);
    for mut session_mapping in observer_list.iter_mut() {
        add_observer_to_device_list(&mut session_mapping, tx.clone(), ObserverType::FrontendObserver, true, true);
    }

    // N Data Processors (one per board)
    for device_mapping in observer_list.iter_mut() {
        let observers: Vec<Sender<BalanceBoardOutput>> = device_mapping.observers_processed.iter()
            .map(|(_, sender)| sender.clone())
            .collect();

        if observers.len() > 0 {
            let tx = data_processor::initialize(observers, device_mapping.mac_address, processing_settings.clone());
            device_mapping.observers_raw.push( (ObserverType::DataProcessor, tx));
        }
    }

    for device_mapping in &observer_list {
        let observers: Vec<Sender<BalanceBoardOutput>> = device_mapping.observers_raw.iter()
            .map(|(_, sender)| sender.clone())
            .collect();

        if observers.len() > 0 {
            let (raw_data_tx, raw_data_rx) = mpsc::channel(10);
            let command = BoardAction::StartRecording(raw_data_tx);
            match hid_board_rx_map.get(&device_mapping.mac_address) {
                Some(sender) => sender.send(command).await.unwrap(),
                None => ()
            }
            initialize_raw_data_forwarder(raw_data_rx, observers);
        }
    }

    println!("Session Debug Information:");
    for device_mapping in observer_list {
        println!(">> Board ID: {:?}", device_mapping.mac_address);
        println!("  Raw data observers: ");
        for (observer_type, _) in &device_mapping.observers_raw {
            print!("{:?} ", observer_type)
        }
        println!("");
        println!("  Processed data observers: ");
        for (observer_type, _) in &device_mapping.observers_processed {
            print!("{:?} ", observer_type)
        }
        println!("");
    }
}


fn initialize_frontend_observer(frontend_channel: Sender<BalanceBoardOutput>) -> Sender<BalanceBoardOutput> {
    let (tx, mut rx) = mpsc::channel(100);

    tokio::spawn(async move {
        while let Some(data) = rx.recv().await {
            frontend_channel.send(data).await?;
        }
        Ok::<(), anyhow::Error>(())
    });

    tx
}

fn initialize_raw_data_forwarder(mut raw_data_rx: mpsc::Receiver<BalanceBoardCalibratedReading>,
                                 mut observers: Vec<Sender<BalanceBoardOutput>>) {
    tokio::spawn(async move {
        while let Some(data) = raw_data_rx.recv().await {
            observers.retain(|observer| {
                match observer.try_send(BalanceBoardOutput::Raw(data.clone())) {
                    Ok(_) => true,
                    Err(_) => false
                }
            });

            if observers.is_empty() {
                break;
            }
        }
    });
}

fn add_observer_to_device_list(session_mapping: &mut SessionMapping,
                               observer: Sender<BalanceBoardOutput>,
                               observer_type: ObserverType,
                               observe_raw_data: bool,
                               observe_processed_data: bool) {
    if observe_raw_data {
        session_mapping.observers_raw.push((observer_type.clone(), observer.clone()) );
    }
    if observe_processed_data {
        session_mapping.observers_processed.push( (observer_type.clone(), observer.clone()) );
    }
}