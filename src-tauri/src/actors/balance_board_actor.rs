use crate::processing;
use crate::processing::lsl_writer::LslConnectionSettings;
use anyhow::Result;
use chrono::Utc;
use serde::Serialize;
#[cfg(feature = "mock")]
use processing::board_hid_reader_mock as board_hid_reader;
#[cfg(not(feature = "mock"))]
use processing::board_hid_reader;
use tokio::sync::mpsc;
use tokio::sync::mpsc::{Receiver, Sender};
use crate::processing::data_processor::{ProcessedBoardData, ProcessingSettings};

// Board primitives
#[derive(Debug, Clone)]
pub enum BoardAction {
    Tare,
    TurnOnLed,
    TurnOffLed,
    StartRecording(Sender<BalanceBoardCalibratedReading>),
    StopRecording
}

#[derive(Debug)]
pub enum BalanceBoardCommands {
    TurnOnLed,
    TurnOffLed,
    ApplyTare,
    StartRecording(mpsc::Sender<BalanceBoardCalibratedReading>),
    FinishRecording,
}

#[derive(Serialize, Debug, Clone)]
pub enum BalanceBoardOutput {
    Raw(BalanceBoardCalibratedReading),
    Processed(ProcessedBoardData),
}

#[derive(Serialize, Debug, Clone)]
pub struct BalanceBoardCalibratedReading {
    pub timestamp: chrono::DateTime<Utc>,
    pub top_right: f32,
    pub bottom_right: f32,
    pub top_left: f32,
    pub bottom_left: f32,
}

impl BalanceBoardOutput {
    pub fn to_byte_array(&self) -> Vec<u8> {
        match self {
            BalanceBoardOutput::Raw(data) => { data.to_byte_array() }
            BalanceBoardOutput::Processed(data) => { data.to_byte_array() }
        }
    }
}

impl BalanceBoardCalibratedReading {
    pub fn to_byte_array(&self) -> Vec<u8> {
        let mut buf = Vec::with_capacity(24);

        // 1. Serialize the timestamp (8 bytes)
        let timestamp_nanos = self.timestamp.timestamp_nanos_opt().unwrap_or(0);
        buf.extend_from_slice(&timestamp_nanos.to_be_bytes());

        // 2. Serialize the f32 readings (16 bytes)
        let readings = [self.top_right, self.bottom_right, self.top_left, self.bottom_left];
        for value in readings.iter() {
            buf.extend_from_slice(&value.to_be_bytes());
        }

        buf
    }
}

impl ProcessedBoardData {
    pub fn to_byte_array(&self) -> Vec<u8> {
        let mut buf = Vec::new();

        // 1. Serialize timestamp (8 bytes)
        let timestamp_nanos = self.timestamp.timestamp_nanos_opt().unwrap_or(0);
        buf.extend_from_slice(&timestamp_nanos.to_be_bytes());

        // 2. Create flags byte indicating which fields are present
        let mut flags = 0u8;
        if self.sway_metrics.is_some() { flags |= 0b00001; }
        if self.area_metrics.is_some() { flags |= 0b00010; }
        if self.frequency_metrics.is_some() { flags |= 0b00100; }
        if self.dfa_alpha.is_some() { flags |= 0b01000; }
        if self.jerk.is_some() { flags |= 0b10000; }

        buf.push(flags);

        // 3. Serialize optional fields based on flags
        if let Some(ref sway) = self.sway_metrics {
            buf.extend_from_slice(&sway.mean_velocity.to_be_bytes());
            buf.extend_from_slice(&sway.total_path_length.to_be_bytes());
            buf.extend_from_slice(&sway.velocity_moment.to_be_bytes());
        }

        if let Some(ref area) = self.area_metrics {
            buf.extend_from_slice(&area.confidence_ellipse_area.to_be_bytes());
            buf.extend_from_slice(&area.convex_hull_area.to_be_bytes());
        }

        if let Some(ref freq) = self.frequency_metrics {
            buf.extend_from_slice(&freq.mean_power_frequency.to_be_bytes());
            buf.extend_from_slice(&freq.center_of_spectrum.to_be_bytes());
            buf.extend_from_slice(&freq.total_power.to_be_bytes());
        }

        if let Some(dfa) = self.dfa_alpha {
            buf.extend_from_slice(&dfa.to_be_bytes());
        }

        if let Some(jerk) = self.jerk {
            buf.extend_from_slice(&jerk.to_be_bytes());
        }

        buf
    }
}


#[derive(Clone, Debug)]
pub struct BalanceBoardSessionSettings {
    pub output_directory: Option<SettingWithMode<String>>,
    pub frontend_channel: Option<SettingWithMode<Sender<BalanceBoardOutput>>>,
    pub lsl_connection: Option<SettingWithMode<LslConnectionSettings>>,
    pub tcp_connection_string: Option<SettingWithMode<String>>,
    pub processing_settings: Option<ProcessingSettings>,
}

#[derive(Clone, Debug)]
pub struct SettingMode {
    pub receive_raw: bool,
    pub receive_processed: bool,
}

impl SettingMode {
    pub fn raw_only() -> SettingMode {
        SettingMode { receive_raw: true, receive_processed: false }
    }

    pub fn processed_only() -> SettingMode {
        SettingMode { receive_raw: false, receive_processed: true }
    }
    
    pub fn all() -> SettingMode {
        SettingMode { receive_raw: true, receive_processed: true }
    }
}

#[derive(Clone, Debug)]
pub struct SettingWithMode<T> {
    pub value: T,
    pub mode: SettingMode,
}

pub fn initialize(device_serial_number: &str) -> Result<Sender<BoardAction>> {
    let (tx, rx) = mpsc::channel(100);

    let board_hid_tx = board_hid_reader::initialize(
        device_serial_number,
    )?;
    
    tokio::spawn(async move{
        balance_board_actor_loop(rx, board_hid_tx).await
    });

    Ok(tx)
}

async fn balance_board_actor_loop(mut rx: Receiver<BoardAction>, board_hid_tx: Sender<BalanceBoardCommands>) {
    loop {
        tokio::select! {
            // Received an action from the manager
            Some(action) = rx.recv() => {
                match action {
                    BoardAction::Tare => {
                        board_hid_tx.send(BalanceBoardCommands::ApplyTare).await.unwrap();
                    }
                    BoardAction::TurnOnLed => {
                        board_hid_tx.send(BalanceBoardCommands::TurnOnLed).await.unwrap();
                    },
                    BoardAction::TurnOffLed => {
                        board_hid_tx.send(BalanceBoardCommands::TurnOffLed).await.unwrap();
                    },
                    BoardAction::StartRecording(raw_data_tx) => {
                        board_hid_tx.send(BalanceBoardCommands::StartRecording(raw_data_tx)).await.unwrap();
                    },
                    BoardAction::StopRecording => {
                        println!("Stopping the recording");
                        // This closes the channel from the balance board side,
                        // which closes all of the subsequent pipeline channels
                        board_hid_tx.send(BalanceBoardCommands::FinishRecording).await.unwrap();
                    },
                }
            },
            else => {
                // Channels closed
                break;
            }
        }
    }
}
