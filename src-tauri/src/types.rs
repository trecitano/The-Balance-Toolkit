use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use crate::file_system;
use crate::processing::data_processor::ProcessingSettings;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GeneralSettings {
    pub tcp_connection_string: String,
    pub tcp_send_raw_data: bool,
    pub tcp_send_processed_data: bool,
    pub lsl_stream_name: String,
    pub lsl_source_id: String,
    pub lsl_send_raw_data: bool,
    pub lsl_send_processed_data: bool,
    pub store_files_default_directory: String,
    pub store_raw_session: bool,
    pub store_processed_data: bool,
    pub processing_settings: ProcessingSettings,
    pub is_demo_mode: bool,
}

impl Default for GeneralSettings {
    fn default() -> GeneralSettings {
        GeneralSettings {
            tcp_connection_string: "localhost:11223".to_string(),
            tcp_send_raw_data: true,
            tcp_send_processed_data: true,

            lsl_stream_name: "the-balance-toolkit".to_string(),
            lsl_source_id: "the-balance-toolkit".to_string(),
            lsl_send_raw_data: true,
            lsl_send_processed_data: true,

            store_files_default_directory: file_system::app_dir().to_str().unwrap().to_string(),
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
    pub selected_user: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub name: String,
    pub age: Option<u8>,
    pub gender: Option<String>,
    pub height: Option<u32>,
    pub height_metric: Option<String>,
    pub weight: Option<u32>,
    pub weight_metric: Option<String>,
    pub handedness: Option<String>,
    pub color: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_default: bool,
}

impl Default for User {
    fn default() -> User {
        User {
            name: "Default User".to_string(),
            age: None,
            gender: None,
            height: None,
            height_metric: None,
            weight: None,
            weight_metric: None,
            handedness: None,
            color: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            is_default: true,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionInformation {
    pub selected_user: String,
    pub available_users: Vec<String>,
    pub selected_boards: Vec<MacAddress>,
    pub enabled_lsl: bool,
    pub enabled_tcp: bool,
    pub output_directory: Option<String>,
    pub is_recording: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "camelCase")]
pub struct NintendoDevice {
    pub id: String,
    pub name: String,
    pub mac_address: u64,
    pub is_connected: bool,
    pub last_connected: Option<DateTime<Utc>>,
}

impl NintendoDevice {
    pub fn is_demo_device (&self) -> bool {
        self.id.starts_with("TBB_MOCKED_DEVICE_ID")
    }
}


pub type MacAddress = u64;

