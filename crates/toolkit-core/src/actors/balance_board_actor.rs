use crate::processing;
use crate::processing::board_hid_file_reader;
use crate::processing::data_processor::ProcessedBoardData;
use crate::types::MacAddress;
use anyhow::Result;
use chrono::Utc;
use processing::board_hid_reader;
use processing::board_hid_reader_mock;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::sync::mpsc::{Receiver, Sender};

// Board primitives
#[derive(Debug, Clone)]
pub enum BoardAction {
    Tare,
    TurnOnLed,
    TurnOffLed,
    StartRecording(Sender<BalanceBoardCalibratedReading>),
    StopRecording,
}

#[derive(Debug)]
pub enum BalanceBoardCommands {
    TurnOnLed,
    TurnOffLed,
    ApplyTare,
    StartRecording(Sender<BalanceBoardCalibratedReading>),
    FinishRecording,
}

/// One sample flowing through the session pipeline. Processed results carry several
/// vectors (polygons, spectrum), so they are shared behind an `Arc`: every observer gets a
/// pointer bump instead of a deep copy.
#[derive(Debug, Clone)]
pub enum BalanceBoardOutput {
    Raw(BalanceBoardCalibratedReading),
    Processed(Arc<ProcessedBoardData>),
}

impl BalanceBoardOutput {
    pub fn mac_address(&self) -> MacAddress {
        match self {
            BalanceBoardOutput::Raw(reading) => reading.mac_address,
            BalanceBoardOutput::Processed(reading) => reading.mac_address,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BalanceBoardCalibratedReading {
    pub timestamp: chrono::DateTime<Utc>,
    pub mac_address: MacAddress,
    pub top_right: f32,
    pub bottom_right: f32,
    pub top_left: f32,
    pub bottom_left: f32,
}

impl BalanceBoardCalibratedReading {
    pub fn apply_tare(&self, tare: &BalanceBoardCalibratedReading) -> Self {
        Self {
            timestamp: self.timestamp,
            mac_address: self.mac_address,
            top_right: self.top_right - tare.top_right,
            bottom_right: self.bottom_right - tare.bottom_right,
            top_left: self.top_left - tare.top_left,
            bottom_left: self.bottom_left - tare.bottom_left,
        }
    }

    pub fn calculate_cop(&self) -> CenterOfPressure {
        let total_force = self.top_right + self.bottom_right + self.top_left + self.bottom_left;
        if total_force.abs() < 0.1 {
            return CenterOfPressure { x: 0.0, y: 0.0 };
        }

        let center_of_pressure_x = ((self.top_right + self.bottom_right)
            - (self.top_left + self.bottom_left))
            / total_force;

        let center_of_pressure_y = ((self.top_right + self.top_left)
            - (self.bottom_right + self.bottom_left))
            / total_force;

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
            BalanceBoardOutput::Raw(data) => data.to_byte_array(),
            BalanceBoardOutput::Processed(data) => data.to_byte_array(),
        }
    }
}

impl BalanceBoardCalibratedReading {
    pub fn to_byte_array(&self) -> Vec<u8> {
        // 8 bytes: timestamp
        // 8 bytes: mac_address (just need 48 bits)
        // 16 bytes: 4 bytes per sensor
        // 8 bytes: 4 bytes per cop
        let mut buf = Vec::with_capacity(40);

        let timestamp_micros = self.timestamp.timestamp_micros();
        buf.extend_from_slice(&timestamp_micros.to_be_bytes());
        buf.extend_from_slice(&self.mac_address.to_be_bytes());

        let readings = [
            self.top_right,
            self.bottom_right,
            self.top_left,
            self.bottom_left,
        ];
        for value in readings.iter() {
            buf.extend_from_slice(&value.to_be_bytes());
        }
        let cop = self.calculate_cop();
        buf.extend_from_slice(&cop.x.to_be_bytes());
        buf.extend_from_slice(&cop.y.to_be_bytes());

        buf
    }
}

pub enum BoardConnectionMode {
    Real,
    Demo,
    ReadFromFile(PathBuf),
}

pub fn initialize(
    mac_address: MacAddress,
    mode: BoardConnectionMode,
) -> Result<Sender<BoardAction>> {
    let (tx, rx) = mpsc::channel(100);

    let board_hid_tx = match mode {
        BoardConnectionMode::Real => board_hid_reader::initialize(mac_address)?,
        BoardConnectionMode::Demo => board_hid_reader_mock::initialize(mac_address)?,
        BoardConnectionMode::ReadFromFile(file_path) => {
            board_hid_file_reader::initialize(mac_address, file_path)?
        }
    };

    tokio::spawn(async move { balance_board_actor_loop(rx, board_hid_tx).await });

    Ok(tx)
}

async fn balance_board_actor_loop(
    mut rx: Receiver<BoardAction>,
    board_hid_tx: Sender<BalanceBoardCommands>,
) {
    while let Some(action) = rx.recv().await {
        let command = match action {
            BoardAction::Tare => BalanceBoardCommands::ApplyTare,
            BoardAction::TurnOnLed => BalanceBoardCommands::TurnOnLed,
            BoardAction::TurnOffLed => BalanceBoardCommands::TurnOffLed,
            BoardAction::StartRecording(raw_data_tx) => {
                BalanceBoardCommands::StartRecording(raw_data_tx)
            }
            BoardAction::StopRecording => {
                log::debug!("Stopping the recording");
                // This closes the channel from the balance board side,
                // which closes all of the subsequent pipeline channels
                BalanceBoardCommands::FinishRecording
            }
        };

        if board_hid_tx.send(command).await.is_err() {
            log::error!("Board reader thread has stopped; shutting down its actor.");
            break;
        }
    }
}
