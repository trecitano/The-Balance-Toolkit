use std::collections::{HashMap, HashSet};
use std::time::Duration;
use tokio::sync::{mpsc, oneshot};
use crate::actors::balance_board_actor::{BalanceBoardSessionSettings, BoardAction};
use crate::actors::bluetooth_service::{BluetoothCommand, BluetoothHandler};
use crate::file_system::DeviceFileSystem;
use crate::types::{MacAddress, NintendoDevice};
use anyhow::Result;
use crate::actors::balance_board_actor;

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

    SelectBoardForSession {
        device_id: String,
    },
    UnselectBoardForSession {
        device_id: String,
    },
    SelectedBoardsForSession {
        response: oneshot::Sender<Vec<String>>,
    },

    StartSession {
        settings: BalanceBoardSessionSettings
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
    connections: HashMap<String, mpsc::Sender<BoardAction>>,
    selected_boards: HashSet<String>,
    bluetooth_manager_tx: mpsc::Sender<BluetoothCommand>,
}

impl ConnectionManager {
    pub fn new(rx: mpsc::Receiver<ToolkitCommand>, tx: mpsc::Sender<ToolkitResponse>) -> Self {
        Self {
            rx,
            tx,
            connections: HashMap::new(),
            selected_boards: HashSet::new(),
            bluetooth_manager_tx: BluetoothHandler::start_bluetooth_handler(),
        }
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


                ToolkitCommand::SelectBoardForSession { device_id } => {
                    self.selected_boards.insert(device_id);
                }
                ToolkitCommand::UnselectBoardForSession { device_id } => {
                    self.selected_boards.remove(&device_id);
                }
                ToolkitCommand::SelectedBoardsForSession { response } => {
                    response.send(self.selected_boards.iter().cloned().collect()).unwrap();
                }


                ToolkitCommand::StartSession { settings } => {
                    println!("Sending start recording command to boards: {:?}", self.selected_boards);
                    println!("State of boards: {:?}", &self.connections);
                    for board in &self.selected_boards {
                        let connection = &self.connections.get(board).unwrap();
                        let command = { BoardAction::StartRecording { settings: settings.clone() } };
                        connection.send(command).await?
                    }
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
        let (action_tx, action_rx) = mpsc::channel(10); // Channel for this specific board

        let serial_number = convert_mac_address_to_string(mac_address);
        let board_connection = balance_board_actor::BalanceBoardConnection::new(&serial_number, action_rx)?;

        tokio::spawn(async move {
            if let Err(e) = board_connection.run().await {
                eprintln!("Board connection task failed: {}", e);
            }
        });
        
        self.connections.insert(device_id.to_string(), action_tx);
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

fn convert_mac_address_to_string(mac_address: MacAddress) -> String {
    mac_address
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<Vec<String>>()
        .join("")
}
