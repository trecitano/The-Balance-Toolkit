use std::path::PathBuf;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use crate::actors::state::activities::Activity;
use crate::actors::toolkit_service::{ReplayConfiguration, CoreSessionConfiguration};
use crate::file_system;
use crate::processing::data_processor::{InterpolationSetting, ProcessingSettings};
use crate::processing::file_writer::SessionStats;

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

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UserPageInformation {
    pub users: Vec<User>,
    pub selected_user_id: usize,
    pub session_devices: Vec<NintendoDevice>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionActivityState {
    pub activity: Activity,
    pub ongoing_state: Option<OngoingSessionActivityState>
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
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
    pub weight: Option<f32>,
    pub weight_metric: Option<String>,
    pub dominant_hand: Option<String>,
    pub color: Option<String>,
    pub notes: Option<String>,
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
            notes: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            is_default: true,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FrontendSessionInformation {
    pub available_users: Vec<SelectOption<usize>>,
    pub selected_boards: Vec<SelectedBoard>,
    pub core: FrontendCoreSession,
    pub activity: Option<Activity>,
    pub has_ongoing_session: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SelectOption<T> {
    pub label: String,
    pub value: T,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FrontendLastSessionInformation {
    pub user: User,
    pub session_stats: SessionStats,
    pub file_location: String,
    pub activity: Option<Activity>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SelectedBoard {
    pub name: String,
    pub mac_address: MacAddress,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FrontendCoreSession {
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

impl From<&CoreSessionConfiguration> for FrontendCoreSession {
    fn from(cfg: &CoreSessionConfiguration) -> Self {
        FrontendCoreSession {
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

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FrontendReplayConfiguration {
    pub user: User,
    pub core: FrontendCoreSession,
    pub devices: Vec<SelectedBoard>,
    pub activity: Option<Activity>,
    pub file_path: PathBuf,
    pub has_ongoing_session: bool,
}

impl From<&ReplayConfiguration> for FrontendReplayConfiguration {
    fn from(cfg: &ReplayConfiguration) -> Self {
        FrontendReplayConfiguration {
            user: cfg.core.user.as_ref().clone(),
            devices: cfg.device_names.iter().map(|(mac_address, name)| {
                SelectedBoard {
                    name: name.clone(),
                    mac_address: *mac_address
                }
            }).collect(),
            core: FrontendCoreSession::from(&cfg.core),
            activity: cfg.core.activity.clone(),
            file_path: cfg.file_path.clone(),
            has_ongoing_session: cfg.replay_start_time.is_some(),
        }
    }
}


#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "camelCase")]
pub struct NintendoDevice {
    pub id: String,
    pub name: String,
    pub mac_address: MacAddress,
    pub is_connected: bool,
    pub last_connected: Option<DateTime<Utc>>,
}

impl NintendoDevice {
    pub fn is_demo_device (&self) -> bool {
        self.id.starts_with("TBB_MOCKED_DEVICE_ID")
    }
}


pub type MacAddress = u64;

