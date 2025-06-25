use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: String,
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
}
