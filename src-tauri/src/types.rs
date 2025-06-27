use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use crate::bluetooth::bluetooth_communication::{BluetoothPeripheral, mac_address_to_wii_pin};

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

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NintendoDevice {
    pub name: String,
    pub address: String,
    pub mac_address: String,
    pub pin: String,
    pub pin_hexa: String,
    pub last_seen: Option<DateTime<Utc>>,
}

impl From<BluetoothPeripheral> for NintendoDevice {
    fn from(p: BluetoothPeripheral) -> Self {
        let mac_str = p.mac_address
            .iter()
            .map(|b| format!("{:02X}", b))
            .collect::<Vec<String>>()
            .join(":");

        let pin_array = mac_address_to_wii_pin(p.mac_address);
        let pin_hex_str = pin_array
            .iter()
            .map(|b| format!("{:02X}", b))
            .collect::<Vec<String>>()
            .join("");

        NintendoDevice {
            name: p.name,
            address: p.id,
            mac_address: mac_str,
            pin: pin_hex_str.clone(),
            pin_hexa: format!("0x{}", pin_hex_str),
            last_seen: None,
        }
    }
}

