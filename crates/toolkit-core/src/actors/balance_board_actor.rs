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
use tokio::sync::mpsc::Sender;

// Board primitives
#[derive(Debug, Clone)]
pub enum BoardAction {
    Tare,
    TurnOnLed,
    TurnOffLed,
    StartRecording(Sender<BalanceBoardCalibratedReading>),
    StopRecording,
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

    /// Sum of the four sensors, i.e. the weight on the board.
    pub fn total_force(&self) -> f32 {
        self.top_right + self.bottom_right + self.top_left + self.bottom_left
    }

    /// Centre of pressure normalised to [-1, 1] on each axis. Zero when the board is empty.
    pub fn calculate_cop(&self) -> CenterOfPressure {
        let total_force = self.total_force();
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

/// Starts the reader for one board and returns the channel used to drive it. Dropping
/// every sender shuts the reader down; `StopRecording` closes the recording channel,
/// which in turn closes every pipeline channel downstream of it.
pub fn initialize(
    mac_address: MacAddress,
    mode: BoardConnectionMode,
) -> Result<Sender<BoardAction>> {
    match mode {
        BoardConnectionMode::Real => board_hid_reader::initialize(mac_address),
        BoardConnectionMode::Demo => board_hid_reader_mock::initialize(mac_address),
        BoardConnectionMode::ReadFromFile(file_path) => {
            board_hid_file_reader::initialize(mac_address, file_path)
        }
    }
}
