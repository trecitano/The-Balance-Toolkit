//! The manager's API types, shared by every frontend. Serde appears only where a type is
//! written to disk or printed by the CLI; those JSON shapes are contracts. Everything
//! else is plain Rust, and a frontend maps it to its own wire format.

use crate::actors::balance_board_actor::BalanceBoardCalibratedReading;
use crate::actors::state::activities::Activity;
use crate::actors::toolkit_service::{
    CalibrationPosition, CoreSessionConfiguration, ReplayConfiguration,
};
use crate::file_system;
use crate::processing::data_processor::{InterpolationSetting, ProcessingSettings};
use crate::processing::file_writer::SessionStats;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GeneralSettings {
    pub tcp_connection_string_raw: String,
    pub tcp_connection_string_processed: String,
    pub tcp_send_raw_data: bool,
    pub tcp_send_processed_data: bool,
    pub lsl_stream_name: String,
    pub lsl_source_id: String,
    pub lsl_send_raw_data: bool,
    pub lsl_send_processed_data: bool,
    pub store_files_default_directory: PathBuf,
    pub store_raw_session: bool,
    pub store_processed_data: bool,
    pub processing_settings: ProcessingSettings,
    pub is_demo_mode: bool,
}

impl Default for GeneralSettings {
    fn default() -> GeneralSettings {
        GeneralSettings {
            tcp_connection_string_raw: "localhost:11223".to_string(),
            tcp_connection_string_processed: "localhost:11224".to_string(),
            tcp_send_raw_data: true,
            tcp_send_processed_data: true,

            lsl_stream_name: "the-balance-toolkit".to_string(),
            lsl_source_id: "the-balance-toolkit".to_string(),
            lsl_send_raw_data: true,
            lsl_send_processed_data: true,

            store_files_default_directory: file_system::session_dir(),
            store_raw_session: true,
            store_processed_data: true,

            processing_settings: ProcessingSettings::default(),
            is_demo_mode: false,
        }
    }
}

#[derive(Debug, Clone)]
pub struct SessionActivityState {
    pub activity: Activity,
    pub ongoing_state: Option<OngoingSessionActivityState>,
}

#[derive(Debug, Clone)]
pub struct OngoingSessionActivityState {
    pub current_block_index: i32,
    pub time_to_next_block_ms: i32,
    pub loop_number: i32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: usize,
    pub name: String,
    pub age: Option<u8>,
    pub gender: Option<String>,
    pub height: Option<f64>,
    pub height_metric: Option<String>,
    /// Always kilograms; this is the session baseline weight.
    pub weight: Option<f32>,
    /// Display unit only (`kg` or `lb`). The frontend converts at its edge.
    pub weight_metric: Option<String>,
    pub dominant_hand: Option<String>,
    pub color: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_default: bool,
}

impl Default for User {
    fn default() -> User {
        User {
            id: 1,
            name: "Default User".to_string(),
            age: None,
            gender: None,
            height: None,
            height_metric: None,
            weight: None,
            weight_metric: None,
            dominant_hand: None,
            color: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            is_default: true,
        }
    }
}

/// Printed by `tbt session show --json`.
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionInformation {
    pub available_users: Vec<UserSummary>,
    pub selected_boards: Vec<SelectedBoard>,
    pub core: SessionSettings,
    pub activity: Option<Activity>,
    pub has_ongoing_session: bool,
}

/// Enough of a user to pick one.
#[derive(Serialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UserSummary {
    pub id: usize,
    pub name: String,
}

impl From<&User> for UserSummary {
    fn from(user: &User) -> Self {
        UserSummary {
            id: user.id,
            name: user.name.clone(),
        }
    }
}

/// Printed by `tbt session last --json`.
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LastSessionInformation {
    pub user: User,
    pub session_stats: SessionStats,
    pub file_location: String,
    pub activity: Option<Activity>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SelectedBoard {
    pub name: String,
    pub mac_address: MacAddress,
}

/// The pipeline settings a frontend may change for a session or replay, with the user
/// and activity by id. The manager resolves them into a `CoreSessionConfiguration`.
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionSettings {
    pub selected_user: usize,
    pub activity_id: Option<String>,
    pub lsl_enabled: bool,
    pub tcp_enabled: bool,
    pub output_directory: PathBuf,
    pub window_size_ms: u64,
    pub window_slide_ms: u64,
    pub sampling_rate: u64,
    pub interpolation: InterpolationSetting,
}

impl From<&CoreSessionConfiguration> for SessionSettings {
    fn from(cfg: &CoreSessionConfiguration) -> Self {
        SessionSettings {
            selected_user: cfg.user.id,
            activity_id: cfg.activity.clone().map(|act| act.id.clone()),
            lsl_enabled: cfg.lsl_enabled,
            tcp_enabled: cfg.tcp_enabled,
            output_directory: cfg.output_directory.clone(),
            window_size_ms: cfg.window_size_ms,
            window_slide_ms: cfg.window_slide_ms,
            sampling_rate: cfg.sampling_rate,
            interpolation: cfg.interpolation.clone(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct ReplayInformation {
    pub user: User,
    pub core: SessionSettings,
    pub devices: Vec<SelectedBoard>,
    pub activity: Option<Activity>,
    pub file_path: PathBuf,
    pub has_ongoing_session: bool,
}

impl From<&ReplayConfiguration> for ReplayInformation {
    fn from(cfg: &ReplayConfiguration) -> Self {
        ReplayInformation {
            user: cfg.core.user.as_ref().clone(),
            devices: cfg
                .device_names
                .iter()
                .map(|(mac_address, name)| SelectedBoard {
                    name: name.clone(),
                    mac_address: *mac_address,
                })
                .collect(),
            core: SessionSettings::from(&cfg.core),
            activity: cfg.core.activity.clone(),
            file_path: cfg.file_path.clone(),
            has_ongoing_session: cfg.running.is_some(),
        }
    }
}

/// Stored in the devices file and printed by `tbt devices list --json`.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "camelCase")]
pub struct NintendoDevice {
    pub id: String,
    pub name: String,
    // Devices files written before the camelCase switch use snake_case keys; accept both so
    // an existing install keeps its boards. The next save rewrites the file in camelCase.
    #[serde(alias = "mac_address")]
    pub mac_address: MacAddress,
    /// Live state. Printed by the CLI, but never read back from the devices file: a board is
    /// disconnected until the manager says otherwise.
    #[serde(skip_deserializing)]
    pub is_connected: bool,
    #[serde(alias = "last_connected")]
    pub last_connected: Option<DateTime<Utc>>,
}

impl NintendoDevice {
    pub fn is_demo_device(&self) -> bool {
        self.id.starts_with("TBB_MOCKED_DEVICE_ID")
    }

    /// The persisted view of this device, for comparing against the devices file.
    pub fn as_stored(&self) -> NintendoDevice {
        NintendoDevice {
            is_connected: false,
            ..self.clone()
        }
    }
}

/// A sensor reading a frontend captured at one calibration position.
#[derive(Debug, Clone)]
pub struct CapturedCalibrationReading {
    pub position: CalibrationPosition,
    pub reading: BalanceBoardCalibratedReading,
}

pub type MacAddress = u64;
