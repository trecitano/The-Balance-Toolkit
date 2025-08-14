use crate::types::{GeneralSettings, MacAddress, NintendoDevice, User};
use serde::Serialize;
use std::fs;
use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;
use anyhow::{Context, Result};
use chrono::Utc;
use serde::de::DeserializeOwned;

#[derive(Serialize)]
pub struct FileMetadata {
    file_name: String,
    user: u64,
    last_updated: String,
    file_path: String,
}

const USERS_FILE: &str = "users.json";
pub struct UserFileSystem;
impl UserFileSystem {
    pub fn get_or_create_default_user() -> Result<User> {
        let users: Vec<User> = FileStore::load(USERS_FILE)?;

        if let Some(default_user) = users.into_iter().find(|u| u.is_default) {
            return Ok(default_user);
        }

        let default_user = User::default();

        Self::add_user(default_user.clone())?;

        Ok(default_user)
    }

    pub fn get_users() -> Result<Vec<User>> {
        let users: Vec<User> = FileStore::load(USERS_FILE)?;
        Ok(users)
    }

    pub fn add_user(new_user: User) -> Result<()> {
        let mut users: Vec<User> = FileStore::load(USERS_FILE)?;
        users.push(new_user);
        FileStore::save(USERS_FILE, &users)
    }

    pub fn update_user(mut updated_user: User) -> Result<()> {
        let mut users = Self::get_users()?;

        users.retain(|user| user.name != updated_user.name);
        updated_user.updated_at = Utc::now();
        users.push(updated_user);

        FileStore::save(USERS_FILE, &users)
    }

    pub fn remove_user(user_name: String) -> Result<()> {
        let mut users = Self::get_users()?;

        users.retain(|user| user.name != user_name);

        save_into_file(USERS_FILE, &users)
    }
}


const NINTENDO_DEVICES_FILE: &str = "nintendo_devices.json";
pub struct DeviceFileSystem;
impl DeviceFileSystem {
    pub fn get_users() -> Result<Vec<User>> {
        let users: Vec<User> = FileStore::load(NINTENDO_DEVICES_FILE)?;
        Ok(users)
    }

    pub fn get_stored_devices() -> Result<Vec<NintendoDevice>> {
        let devices: Vec<NintendoDevice> = FileStore::load(NINTENDO_DEVICES_FILE)?;
        Ok(devices)
    }

    pub fn update_board_name(mac_address: MacAddress, device_board_name: String) -> Result<()> {
        let mut devices = Self::get_stored_devices()?;

        if let Some(device) = devices.iter_mut().find(|device| device.mac_address == mac_address) {
            device.name = device_board_name;
        }

        FileStore::save(NINTENDO_DEVICES_FILE, &devices)
    }

    pub fn update_file_system_boards(devices: &Vec<NintendoDevice>) -> Result<()> {
        // Check if we really need to update the file system.
        // If the boards in the file system and in our argument are the same, we return.
        let file_system_devices = Self::get_stored_devices()?;

        let mut sorted_file_system = file_system_devices.clone();
        let mut sorted_devices = devices.clone();
        sorted_file_system.sort();
        sorted_devices.sort();

        if sorted_file_system == sorted_devices {
            return Ok(());
        }

        FileStore::save(NINTENDO_DEVICES_FILE, &devices)
    }
}

const SETTINGS_FILE: &str = "settings.json";
pub struct SettingsFileSystem;
impl SettingsFileSystem {
    pub fn get_or_create_default_settings() -> Result<GeneralSettings> {
        let settings: GeneralSettings = FileStore::load(SETTINGS_FILE)?;

        Ok(settings)
    }

    pub fn save_settings(settings: &GeneralSettings) -> Result<()> {
        let old_settings: GeneralSettings = FileStore::load(SETTINGS_FILE)?;

        if old_settings == *settings {
            return Ok(());
        }

        FileStore::save(SETTINGS_FILE, &settings)
    }
}


// PRIMITIVES

struct FileStore;

impl FileStore {
    pub fn load<T>(file_name: &str) -> Result<T>
    where
        T: Serialize + DeserializeOwned + Default,
    {
        let file_path = app_dir().join(file_name);

        if !file_path.exists() {
            return Ok(T::default());
        }

        let file = File::open(&file_path)
            .with_context(|| format!("Failed to open file: {:?}", file_path))?;

        let reader = BufReader::new(file);

        let data = match serde_json::from_reader(reader) {
            Ok(data) => data,
            Err(e) if e.is_eof() => T::default(),
            Err(e) => return Err(e.into()),
        };

        Ok(data)
    }

    pub fn save<T>(file_name: &str, data: T) -> Result<()>
    where
        T: Serialize,
    {
        let file_path = app_dir().join(file_name);

        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let file = File::create(&file_path)
            .with_context(|| format!("Failed to create file: {:?}", file_path))?;
        serde_json::to_writer_pretty(file, &data)
            .with_context(|| format!("Failed to save file: {:?}", file_path))?;

        Ok(())
    }
}

pub fn initialize_app_dir() -> Result<()> {
    let app_dir = app_dir();

    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)?;
    }

    Ok(())
}

fn app_dir_file(file_name: &str) -> Result<File> {
    let file_path = app_dir().join(file_name);

    let file = File::create(file_path)
        .with_context(|| format!("Failed to open file: {}", file_name))?;
    Ok(file)
}

pub fn app_dir() -> PathBuf {
    dirs::document_dir()
        .map(|path| path.join("the-balance-toolkit"))
        .expect("Could not access dir file")
}

fn save_into_file<T: Serialize>(file_name: &str, data: T) -> anyhow::Result<()> {
    let file = app_dir_file(file_name)?;

    serde_json::to_writer_pretty(file, &data)
        .with_context(|| format!("Failed to save file: {}", file_name))?;

    Ok(())
}
