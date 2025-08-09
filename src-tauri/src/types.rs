use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

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
    pub selected_boards: Vec<String>,
    pub enabled_lsl: bool,
    pub enabled_tcp: bool,
    pub output_directory: Option<String>,
    pub is_recording: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NintendoDevice {
    pub id: String,
    pub name: String,
    pub mac_address: String,
    pub is_connected: bool,
    pub last_connected: Option<DateTime<Utc>>,
}

pub type MacAddress = [u8; 6];

