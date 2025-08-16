use crate::processing::data_processor::ProcessedBoardData;
use crate::types::MacAddress;
use crate::processing;
use anyhow::Result;
use chrono::Utc;
use processing::board_hid_reader;
use processing::board_hid_reader_mock;
use serde::Serialize;
use tokio::sync::mpsc;
use tokio::sync::mpsc::{Receiver, Sender};

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
    StartRecording(Sender<BalanceBoardCalibratedReading>),
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
    pub mac_address: MacAddress,
    pub top_right: f32,
    pub bottom_right: f32,
    pub top_left: f32,
    pub bottom_left: f32,
}

impl BalanceBoardCalibratedReading {
    pub fn calculate_cop(&self) -> CenterOfPressure {
        let x_value = 216.5; // TODO FIX THIS HARDCODED VALUE!
        let y_value = 119.0;

        let total_force = self.top_right + self.bottom_right + self.top_left + self.bottom_left;
        if total_force.abs() < 0.1 {
            return CenterOfPressure {
                x: 0.0,
                y: 0.0
            }
        }

        let center_of_pressure_x =
            x_value * ((self.top_right + self.bottom_right) - (self.top_left + self.bottom_left)) / total_force;

        let center_of_pressure_y =
            y_value * ((self.top_right + self.top_left) - (self.bottom_right + self.bottom_left)) / total_force;

        CenterOfPressure {
            x: center_of_pressure_x,
            y: center_of_pressure_y,
        }
    }
}

pub struct CenterOfPressure {
    pub x: f32,
    pub y: f32,
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

pub fn initialize(mac_address: MacAddress, is_demo_mode: bool) -> Result<Sender<BoardAction>> {
    let (tx, rx) = mpsc::channel(100);

    let board_hid_tx = if is_demo_mode {
        board_hid_reader_mock::initialize(mac_address)?
    } else {
        board_hid_reader::initialize(mac_address)?
    };
    
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
