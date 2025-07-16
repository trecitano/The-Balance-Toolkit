use crate::balance_board_com;
use crate::balance_board_com::BoardAction;
use crate::bluetooth::bluetooth_communication;
use std::collections::{HashMap, HashSet};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, oneshot};
use crate::file_system::DeviceFileSystem;
use crate::types::{MacAddress, NintendoDevice};

// Commands that can be sent to the ConnectionManager
#[derive(Debug)]
pub enum ManagerCommand {
    // Manager main actions
    StartScan {
        device_found_channel: AppHandle,
    },
    StopScan,
    IsScanning {
        responder: oneshot::Sender<bool>,
    },

    GetBoardsSystemView {
        responder: oneshot::Sender<Vec<NintendoDevice>>,
    },
    ConnectedBoards {
        responder: oneshot::Sender<Vec<String>>,
    },
    Connect {
        device_id: String,
    },
    Disconnect {
        device_id: String,
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
        responder: oneshot::Sender<Vec<String>>,
    },

    StartSession,
    StopSession,

    BoardAction {
        device_id: String,
        action: BoardAction,
    },
}

pub struct ConnectionManager {
    manager_tx: mpsc::Sender<ManagerCommand>,
    manager_rx: mpsc::Receiver<ManagerCommand>,
    connections: HashMap<String, mpsc::Sender<BoardAction>>,
    selected_boards: HashSet<String>,
    scan_cancel_tx: Option<oneshot::Sender<()>>,
}

impl ConnectionManager {
    pub fn new(manager_tx: mpsc::Sender<ManagerCommand>, manager_rx: mpsc::Receiver<ManagerCommand>) -> Self {
        Self {
            manager_tx,
            manager_rx,
            connections: HashMap::new(),
            selected_boards: HashSet::new(),
            scan_cancel_tx: None,
        }
    }

    pub async fn run(mut self) {
        println!("Connection manager started.");
        
        while let Some(command) = self.manager_rx.recv().await {
            match command {
                // --------------------
                // SCANNING COMMANDS
                // --------------------
                ManagerCommand::StartScan { device_found_channel } => {
                    self.scan(device_found_channel).await;
                },
                ManagerCommand::StopScan => {
                    self.scan_cancel_tx = None;
                },
                ManagerCommand::IsScanning { responder } => {
                    responder.send(self.scan_cancel_tx.is_some()).unwrap();
                },

                ManagerCommand::GetBoardsSystemView { responder } => {
                    responder.send(self.boards_system_view().await.unwrap()).unwrap();
                },
                ManagerCommand::ConnectedBoards { responder } => {
                    responder
                        .send(self.connections.keys().cloned().collect())
                        .unwrap();
                }
                ManagerCommand::Connect { device_id } => {
                    self.connect(device_id).await;
                }
                ManagerCommand::Disconnect { device_id } => {
                    self.disconnect(device_id);
                }
                ManagerCommand::IdentifyBoard { device_id } => {
                    self.identify_board(device_id);
                }


                ManagerCommand::SelectBoardForSession { device_id } => {
                    self.selected_boards.insert(device_id);
                }
                ManagerCommand::UnselectBoardForSession { device_id } => {
                    self.selected_boards.remove(&device_id);
                }
                ManagerCommand::SelectedBoardsForSession { responder } => {
                    responder.send(self.selected_boards.iter().cloned().collect()).unwrap();
                }


                ManagerCommand::BoardAction { device_id, action } => {
                    self.board_action(device_id, action).await;
                }

                _ => {}
            }
        }
        
        println!("Connection manager stopped.");
    }


    // Returns a list of both previous and connected devices.
    // If a device is found to be connected to the Operating System, but the manager doesn't know about it,
    // then the manager automatically connects to it.
    pub async fn boards_system_view(&mut self) -> Result<Vec<NintendoDevice>, String> {
        let stored_devices = DeviceFileSystem::get_stored_devices().map_err(|e| e.to_string())?;
        let os_connected_devices: Vec<NintendoDevice> =
            bluetooth_communication::get_nintendo_devices()
                .await
                .map_err(|e| e.to_string())?
                .into_iter()
                .map(|p| p.into())
                .collect();

        // Connect the manager to any missing devices.
        for device in &os_connected_devices {
            let device_id = device.mac_address.replace(":", "");
            println!("Checking if device {} is connected.", device_id);
            if !self.connections.contains_key(&device_id) {
                println!("NEED TO CONNECT {}", device_id);
                self.connect(device_id).await;
            }
        }

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

    // This is a long action, so we execute this in a background task
    async fn scan(&mut self, emitter: AppHandle) {
        if self.scan_cancel_tx.is_some() {
            println!("Scan is already in progress.");
            return;
        }

        let (cancel_tx, mut cancel_rx) = oneshot::channel();
        self.scan_cancel_tx = Some(cancel_tx);

        let manager_tx = self.manager_tx.clone();
        tokio::spawn(async move {
            println!("Scanning for devices in background...");
            loop {
                tokio::select! {
                    _ = &mut cancel_rx => {
                        println!("Scan cancelled.");
                        break;
                    }
                    new_board_bluetooth = bluetooth_communication::connect_new_balance_board() => {
                        if let Ok(mac_address) = new_board_bluetooth {
                            tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;
                            let device_id = convert_mac_address_to_string(mac_address);
                            manager_tx.send(ManagerCommand::Connect { device_id }).await.unwrap();

                            match bluetooth_communication::get_nintendo_device_by_mac_address(mac_address).await {
                                Ok(device) => emitter.emit("new_board", NintendoDevice::from(device)).unwrap(),
                                Err(e) => eprintln!("Error getting device info by mac address: {:?}", e),
                            }
                        }
                    },
                }
            }

            println!("Exiting background scan task.");
        });
    }

    async fn connect(&mut self, device_id: String) {
        if self.connections.contains_key(&device_id) {
            println!("Device {} is already connected.", device_id);
            return;
        }

        println!("Connecting to device: {}", device_id);
        let (action_tx, action_rx) = mpsc::channel(10); // Channel for this specific board

        let id_clone = device_id.clone();
        match balance_board_com::BalanceBoardConnection::new(&id_clone, action_rx) {
            Ok(board_connection) => {
                tokio::spawn(async move {
                    board_connection.run().await;
                });
                self.connections.insert(device_id, action_tx);
                println!("Successfully connected to device {}", id_clone);
            }
            Err(e) => {
                eprintln!(
                    "Failed to create connection for device {}: {}",
                    device_id, e
                );
            }
        }
    }

    fn disconnect(&mut self, device_id: String) {
        if let Some(_) = self.connections.remove(&device_id) {
            println!("Disconnected device: {}", device_id);
        } else {
            eprintln!(
                "Attempted to disconnect a non-existent device: {}",
                device_id
            );
        }
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
            let mut is_on = true;
            board_channel_clone.send(BoardAction::TurnOffLed).await;

            for _ in 0..10 {
                board_channel_clone.send(BoardAction::TurnOnLed).await;
                tokio::time::sleep(Duration::from_millis(100)).await;
                board_channel_clone.send(BoardAction::TurnOffLed).await;
                tokio::time::sleep(Duration::from_millis(100)).await;
                board_channel_clone.send(BoardAction::TurnOnLed).await;
                tokio::time::sleep(Duration::from_millis(100)).await;
                board_channel_clone.send(BoardAction::TurnOffLed).await;
                tokio::time::sleep(Duration::from_millis(800)).await;
            }

            board_channel_clone.send(BoardAction::TurnOnLed).await;
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
