use std::collections::{HashMap, HashSet};
use std::time::Duration;
use tokio::sync::{mpsc, oneshot};
use crate::actors::balance_board_actor::{BalanceBoardCalibratedReading, BalanceBoardOutput, SessionSettings, BoardAction, SettingMode};
use crate::actors::bluetooth_service::{BluetoothCommand, BluetoothHandler};
use crate::file_system::{DeviceFileSystem, SessionFileSystem};
use crate::types::{MacAddress, NintendoDevice, SessionInformation, User};
use anyhow::Result;
use tokio::sync::mpsc::Sender;
use file_system::UserFileSystem;
use crate::actors::balance_board_actor;
use crate::file_system;
use crate::processing::{data_processor, file_writer, lsl_writer, tcp_writer};

// Commands that can be sent to the ConnectionManager
#[derive(Debug)]
pub enum ToolkitCommand {
    // Manager main actions
    BluetoothAction(BluetoothCommand),

    GetBoardsSystemView {
        responder: oneshot::Sender<Vec<NintendoDevice>>,
    },

    Connect {
        device_id: String,
        mac_address: MacAddress,
        response: oneshot::Sender<bool>,
    },
    IdentifyBoard {
        device_id: String,
    },

    SelectUser {
        user_name: String,
    },
    GetSelectedUser {
        response: oneshot::Sender<String>
    },
    SelectBoardForSession {
        device_id: String,
    },
    UnselectBoardForSession {
        device_id: String,
    },
    SelectedBoardsForSession {
        response: oneshot::Sender<Vec<String>>,
    },

    SessionInformation {
        response: oneshot::Sender<SessionInformation>,
    },
    StartSession {
        frontend_channel: Sender<BalanceBoardOutput>
    },
    StopSession,

    BoardAction {
        device_id: String,
        action: BoardAction,
    },
}

pub enum ToolkitResponse {
    NewDeviceFound(NintendoDevice),
}

pub struct ConnectionManager {
    rx: mpsc::Receiver<ToolkitCommand>,
    tx: mpsc::Sender<ToolkitResponse>,
    bluetooth_manager_tx: mpsc::Sender<BluetoothCommand>,

    selected_user: String,
    session_settings: SessionSettings,
    connections: HashMap<String, mpsc::Sender<BoardAction>>,
    selected_boards: HashSet<String>,
    is_recording: bool,
}

impl ConnectionManager {
    pub fn new(rx: mpsc::Receiver<ToolkitCommand>, tx: mpsc::Sender<ToolkitResponse>) -> Result<Self> {
        let selected_user = UserFileSystem::get_or_create_default_user()?.name;
        let session_settings = SessionFileSystem::get_or_create_default_session_settings()?;

        Ok(Self {
            rx,
            tx,
            bluetooth_manager_tx: BluetoothHandler::start_bluetooth_handler(),

            selected_user,
            session_settings,
            connections: HashMap::new(),
            selected_boards: HashSet::new(),
            is_recording: false,
        })
    }

    pub async fn run(mut self) -> Result<()> {
        println!("Balance Walker Service started.");
        
        while let Some(command) = self.rx.recv().await {
            match command {
                ToolkitCommand::BluetoothAction(action)=> {
                    self.bluetooth_manager_tx.send(action).await?;
                }
                ToolkitCommand::GetBoardsSystemView { responder } => {
                    let result = self.boards_system_view().await?;
                    responder.send(result).unwrap();
                },

                ToolkitCommand::Connect { device_id, mac_address, response } => {
                    self.connect(&device_id, mac_address).await;
                    response.send(true).unwrap();
                }
                ToolkitCommand::IdentifyBoard { device_id } => {
                    self.identify_board(device_id);
                }

                ToolkitCommand::SelectUser { user_name } => {
                    self.selected_user = user_name;
                }
                ToolkitCommand::GetSelectedUser { response } => {
                    response.send(self.selected_user.clone()).unwrap();
                }
                ToolkitCommand::SelectBoardForSession { device_id } => {
                    self.selected_boards.insert(device_id);
                }
                ToolkitCommand::UnselectBoardForSession { device_id } => {
                    self.selected_boards.remove(&device_id);
                }
                ToolkitCommand::SelectedBoardsForSession { response } => {
                    response.send(self.selected_boards.iter().cloned().collect()).unwrap();
                }

                ToolkitCommand::SessionInformation { response } => {
                    let session_information = SessionInformation {
                        selected_user: self.selected_user.clone(),
                        available_users: UserFileSystem::get_users()?.into_iter().map(|user| user.name).collect(),
                        selected_boards: self.selected_boards.iter().cloned().collect(),
                        enabled_lsl: self.session_settings.lsl_connection.is_some(),
                        enabled_tcp: self.session_settings.tcp_connection_string.is_some(),
                        output_directory: match &self.session_settings.output_directory {
                            Some(config) => Some(config.value.clone()),
                            None => None,
                        },
                        is_recording: self.is_recording,
                    };
                    response.send(session_information).unwrap();
                }
                ToolkitCommand::StartSession { frontend_channel } => {
                    let settings = self.session_settings.clone();

                    start_session(settings, frontend_channel, &self.selected_boards, &self.connections).await;
                },
                ToolkitCommand::StopSession => {
                    for board in &self.selected_boards {
                        let connection = &self.connections.get(board).unwrap();
                        let command = { BoardAction::StopRecording };       
                        connection.send(command).await?
                    }
                }


                ToolkitCommand::BoardAction { device_id, action } => {
                    self.board_action(device_id, action).await;
                }
            }
        }
        
        println!("Balance Walker Service stopped.");
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
            let device_id = &device.id;
            let mac_address = device.mac_address;
            println!("Checking if device {} is connected.", device_id);
            if !self.connections.contains_key(device_id) {
                println!("NEED TO CONNECT {}", device_id);
                self.connect(device_id, mac_address).await;
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

        Ok(result)
    }

    async fn connect(&mut self, device_id: &str, mac_address: MacAddress) -> Result<()> {
        if self.connections.contains_key(device_id) {
            println!("Device {} is already connected.", device_id);
            return Ok(());
        }

        println!("Connecting to device: {}", device_id);
        let serial_number = convert_mac_address_to_string(mac_address);
        let board_connection = balance_board_actor::initialize(&serial_number)?;

        self.connections.insert(device_id.to_string(), board_connection);
        // TODO
        //self.tx.send(ToolkitResponse::NewDeviceFound())
        Ok(())
    }

    // This is a long action, so we execute this in a background task
    fn identify_board(&self, device_id: String) {
        let board = match self.connections.get(&device_id) {
            Some(board) => board,
            None => {
                eprintln!("Attempted to identify a non-existent device: {}", device_id);
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

    async fn board_action(&self, device_id: String, action: BoardAction) {
        let board = match self.connections.get(&device_id) {
            Some(board) => board,
            None => {
                eprintln!("Attempted to identify a non-existent device: {}", device_id);
                return;
            }
        };

        if let Err(e) = board.send(action).await {
            eprintln!("Failed to forward action to device {}: {}", device_id, e);
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
    device_id: String,
    observers_raw: Vec<(ObserverType, Sender<BalanceBoardOutput>)>,
    observers_processed: Vec<(ObserverType, Sender<BalanceBoardOutput>)>,
}
async fn start_session(settings: SessionSettings,
                       frontend_channel: Sender<BalanceBoardOutput>,
                       selected_boards: &HashSet<String>,
                       hid_board_rx_map: &HashMap<String, mpsc::Sender<BoardAction>>) {
    let mut observer_list: Vec<SessionMapping> = vec!();
    for board_id in selected_boards {   
        observer_list.push(SessionMapping {
            device_id: board_id.clone(),
            observers_raw: vec!(),
            observers_processed: vec!(),
        })
    }

    // N file writers (one per board)
    if let Some(config) = settings.output_directory {
        let processing_settings = settings.processing_settings.clone();
        let config_mode = config.mode;

        for mut session_mapping in observer_list.iter_mut() {
            let output_directory = &config.value;
            let tx = file_writer::initialize(
                output_directory.clone(),
                config_mode.clone(),
                session_mapping.device_id.clone(),
                processing_settings.clone()
            );

            add_observer_to_device_list(tx, ObserverType::FileWriter, &config_mode, &mut session_mapping);
        }
    }

    // 1 LSL Writer
    if let Some(config) = settings.lsl_connection {
        let tx = lsl_writer::initialize(config.value);
        for mut session_mapping in observer_list.iter_mut() {
            add_observer_to_device_list(tx.clone(), ObserverType::LslWriter, &config.mode, &mut session_mapping);
        }
    }

    // 1 TCP Writer
    if let Some(config) = settings.tcp_connection_string {
        let tx = tcp_writer::initialize(config.value);
        for mut session_mapping in observer_list.iter_mut() {
            add_observer_to_device_list(tx.clone(), ObserverType::TcpWriter, &config.mode, &mut session_mapping);
        }
    };

    // 1 Frontend Observer
    let tx = initialize_frontend_observer(frontend_channel);
    for mut session_mapping in observer_list.iter_mut() {
        add_observer_to_device_list(tx.clone(), ObserverType::FrontendObserver, &SettingMode::all(), &mut session_mapping);
    }

    // N Data Processors (one per board)
    for device_mapping in observer_list.iter_mut() {
        let observers: Vec<Sender<BalanceBoardOutput>> = device_mapping.observers_processed.iter()
            .map(|(_, sender)| sender.clone())
            .collect();

        if observers.len() > 0 {
            let tx = data_processor::initialize(observers, settings.processing_settings.clone().unwrap());
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
            match hid_board_rx_map.get(&device_mapping.device_id) {
                Some(sender) => sender.send(command).await.unwrap(),
                None => ()
            }
            initialize_raw_data_forwarder(raw_data_rx, observers);
        }
    }

    println!("Session Debug Information:");
    for device_mapping in observer_list {
        println!(">> Board ID: {}", device_mapping.device_id);
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

fn add_observer_to_device_list(observer: Sender<BalanceBoardOutput>,
                               observer_type: ObserverType,
                               setting_mode: &SettingMode,
                               session_mapping: &mut SessionMapping) {
    if setting_mode.receive_raw {
        session_mapping.observers_raw.push((observer_type.clone(), observer.clone()) );
    }
    if setting_mode.receive_processed {
        session_mapping.observers_processed.push( (observer_type.clone(), observer.clone()) );
    }
}


fn add_observer_to_vecs(observer: Sender<BalanceBoardOutput>,
                        setting_mode: &SettingMode,
                        raw_data_observers: &mut Vec<Sender<BalanceBoardOutput>>,
                        processed_data_observers: &mut Vec<Sender<BalanceBoardOutput>>) {
    if setting_mode.receive_raw {
        raw_data_observers.push(observer.clone());
    }
    if setting_mode.receive_processed {
        processed_data_observers.push(observer);
    }
}

fn convert_mac_address_to_string(mac_address: MacAddress) -> String {
    mac_address
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<Vec<String>>()
        .join("")
}
