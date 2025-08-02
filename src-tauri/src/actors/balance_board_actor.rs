use anyhow::{anyhow, Result};
use chrono::Utc;
use hidapi::{HidApi, HidDevice};
use std::thread;
use tokio::sync::broadcast;
use tokio::sync::mpsc;
use tokio::task;
use processing::board_hid_reader;
use crate::processing;
use crate::processing::board_hid_reader::{BalanceBoardCalibratedReading, BalanceBoardCommands};
use crate::processing::{data_processor, file_writer, lsl_writer, tcp_writer};
use crate::processing::data_processor::ProcessedBoardData;
use crate::processing::lsl_writer::LslConnectionSettings;

// Board primitives
#[derive(Debug, Clone)]
pub enum BoardAction {
    Tare,
    TurnOnLed,
    TurnOffLed,
    StartRecording {
        settings: BalanceBoardSessionSettings
    },
    StopRecording,
}

#[derive(Clone, Debug)]
pub struct BalanceBoardSessionSettings {
    pub output_file: Option<String>,
    pub output_channel: Option<mpsc::Sender<ProcessedBoardData>>,
    pub lsl_connection: Option<LslConnectionSettings>,
    pub tcp_connection_string: Option<String>,
}

pub struct BalanceBoardConnection {
    device: HidDevice,
    action_rx: mpsc::Receiver<BoardAction>
}

impl BalanceBoardConnection {
    pub fn new(serial_number: &str, action_rx: mpsc::Receiver<BoardAction>) -> Result<Self> {
        let api = HidApi::new()?;
        // The serial number of a nintendo balance board is the string version of a mac address.
        // If the mac address is "00:23:31:87:B1:16", its serial number is "00233187B116".
        println!("Look for {}", serial_number);
        let balance_board_info = api
            .device_list()
            .find(|device| {
                println!("Device: {:?}", device.serial_number());
                if let Some(hid_serial_number) = device.serial_number() {
                    hid_serial_number == serial_number
                } else {
                    false
                }
            })
            .ok_or(anyhow!("Device with the specified device_id was not found."))?;

        let device = balance_board_info.open_device(&api)?;
        println!("Successfully opened HID connection for {}.", serial_number);

        Ok(Self {
            device,
            action_rx,
        })
    }

    pub async fn run(mut self) -> Result<()> {
        println!("Board connection task started.");
        let device = self.device;

        let (hid_control_tx, hid_control_rx) = mpsc::channel(10);
        let (hid_data_tx, mut hid_data_rx) = mpsc::channel(10);

        // Since HIDAPI is blocking, we need to run the core device loop in a blocking thread.
        let hid_thread = board_hid_reader::initialize(
            device,
            hid_control_rx,
            hid_data_tx
        );

        let mut session: Option<SessionHandles> = None;

        loop {
            if let Some(s) = &session {
                println!("Receiver channel state: {:?}", s.receiver_channel.is_closed());
            }

            //println!("is closed: {}", &session.unwrap().receiver_channel.is_closed());
            tokio::select! {
                // Received an action from the manager
                Some(action) = self.action_rx.recv() => {
                    match action {
                        BoardAction::Tare => {
                            // TODO
                            //hid_control_tx.send(BalanceBoardCommands::Tare).await?;
                        }
                        BoardAction::TurnOnLed => {
                            hid_control_tx.send(BalanceBoardCommands::TurnOnLed).await.unwrap();
                        },
                        BoardAction::TurnOffLed => {
                            hid_control_tx.send(BalanceBoardCommands::TurnOffLed).await.unwrap();
                        },
                        BoardAction::StartRecording { settings } => {
                            session = Some(Self::start_session(settings)?);
                            println!("Starting recording session with following sessions: {:?}", session);

                                        if let Some(s) = &session {
                println!("JUST STARTED Receiver channel state: {:?}", s.receiver_channel.is_closed());
            }



                            hid_control_tx.send(BalanceBoardCommands::StartRecording).await.unwrap();
                        },
                        BoardAction::StopRecording => {
                            println!("Stopping the recording");
                            session = None;
                            hid_control_tx.send(BalanceBoardCommands::FinishRecording).await.unwrap();
                        },
                    }
                },

                // Received data from the HID thread
                Some(data) = hid_data_rx.recv() => {


            if let Some(s) = &session {
                println!("RIGHT BEFORE: channel state: {:?}", s.receiver_channel.is_closed());
            }

                    // If there's a session, we forward the data to it.
                    if let Some(session) = &mut session {
                        session.receiver_channel.send(data).await.map_err(anyhow::Error::from).unwrap();
                    }
                },
                else => {
                    println!("Channels closed debug"); // DEBUG
                    // Channels closed
                    break;
                }
            }
        }

        // Wait for the HID thread to finish.
        let _ = hid_thread.join();
        println!("Board connection task finished.");
        Ok(())
    }

    fn start_session(settings: BalanceBoardSessionSettings) -> Result<SessionHandles> {
        let mut thread_handles: Vec<thread::JoinHandle<Result<()>>> = vec!();
        let mut task_handles: Vec<task::JoinHandle<Result<()>>> = vec!();

        let (processed_data_tx, processed_data_rx) = broadcast::channel::<ProcessedBoardData>(100);

        if let Some(output_file) = settings.output_file {
            let file_writer_rx = processed_data_tx.subscribe();
            let handle = file_writer::initialize(file_writer_rx, output_file);
            task_handles.push(handle);
        }

        if let Some(lsl_connection) = settings.lsl_connection {
            let lsl_rx = processed_data_tx.subscribe();
            let handle = lsl_writer::initialize(lsl_rx, lsl_connection);
            thread_handles.push(handle);
        }

        if let Some(tcp_connection_string) = settings.tcp_connection_string {
            let tcp_rx = processed_data_tx.subscribe();
            let handle = tcp_writer::initialize(tcp_rx, tcp_connection_string);
            task_handles.push(handle);
        };
        
        if let Some(output_channel) = settings.output_channel {
            let mut output_channel_rx = processed_data_tx.subscribe();
            let handle = tokio::spawn(async move {
                while let Ok(data) = output_channel_rx.recv().await {
                    println!("sending data :)");
                    output_channel.send(data).await?;
                }
                Ok(())
            });
            task_handles.push(handle);
        }

        let (data_process_tx, data_process_rx) = mpsc::channel(100);
        let handle = data_processor::initialize(data_process_rx, processed_data_tx);
        task_handles.push(handle);

        Ok(SessionHandles { thread_handles, task_handles, receiver_channel: data_process_tx })
    }
}

 #[derive(Debug)]
struct SessionHandles {
    thread_handles: Vec<thread::JoinHandle<Result<()>>>,
    task_handles: Vec<task::JoinHandle<Result<()>>>,
    receiver_channel: mpsc::Sender<BalanceBoardCalibratedReading>,
}