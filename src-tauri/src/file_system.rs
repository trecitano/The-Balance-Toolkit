use crate::types::{GeneralSettings, MacAddress, NintendoDevice, User};
use serde::{Deserialize, Serialize};
use std::fs;
use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use anyhow::{Context, Result};
use chrono::{DateTime, NaiveDateTime, Utc};
use serde::de::DeserializeOwned;
use crate::actors::state::activities::{Activity, ActivityState};
use crate::processing::file_writer::{SessionConfigurationFileFormat, SessionConfigurationFileFormatRef};

const USERS_FILE: &str = "users.json";
pub struct UserFileSystem;
impl UserFileSystem {

    pub fn get_users() -> Result<Vec<User>> {
        let users: Vec<User> = FileStore::load_with_default(Path::new(USERS_FILE))?;
        Ok(users)
    }

    pub fn add_user(new_user: User) -> Result<()> {
        let mut users: Vec<User> = FileStore::load_with_default(Path::new(USERS_FILE))?;
        users.push(new_user);
        FileStore::save(Path::new(USERS_FILE), &users)
    }

    pub fn update_user(mut updated_user: User) -> Result<()> {
        let mut users = Self::get_users()?;

        users.retain(|user| user.name != updated_user.name);
        updated_user.updated_at = Utc::now();
        users.push(updated_user);

        FileStore::save(Path::new(USERS_FILE), &users)
    }

    pub fn remove_user(user_name: String) -> Result<()> {
        let mut users = Self::get_users()?;

        users.retain(|user| user.name != user_name);

        save_into_file(Path::new(USERS_FILE), &users)
    }

    pub fn save(users: &Vec<Arc<User>>) -> Result<()> {
        FileStore::save(Path::new(USERS_FILE), &users)
    }
}


const NINTENDO_DEVICES_FILE: &str = "nintendo_devices.json";
pub struct DeviceFileSystem;
#[derive(Serialize, Deserialize)]
pub struct FileSystemNintendoDevice {
    pub id: String,
    pub name: String,
    pub mac_address: MacAddress,
    pub last_connected: Option<DateTime<Utc>>,
}
impl From<&NintendoDevice> for FileSystemNintendoDevice {
    fn from(device: &NintendoDevice) -> Self {
        FileSystemNintendoDevice {
            id: device.id.clone(),
            name: device.name.clone(),
            mac_address: device.mac_address,
            last_connected: device.last_connected
        }
    }
}

impl From<FileSystemNintendoDevice> for NintendoDevice {
    fn from(val: FileSystemNintendoDevice) -> Self {
        NintendoDevice {
            id: val.id.clone(),
            name: val.name.clone(),
            mac_address: val.mac_address,
            is_connected: false,
            last_connected: val.last_connected
        }
    }
}

impl DeviceFileSystem {
    pub fn get_stored_devices() -> Result<Vec<NintendoDevice>> {
        let file_system_devices: Vec<FileSystemNintendoDevice> = FileStore::load_with_default(Path::new(NINTENDO_DEVICES_FILE))?;

        let devices = file_system_devices.into_iter().map(|device| device.into()).collect();

        Ok(devices)
    }

    pub fn update_board_name(mac_address: MacAddress, device_board_name: String) -> Result<()> {
        let mut devices = Self::get_stored_devices()?;

        if let Some(device) = devices.iter_mut().find(|device| device.mac_address == mac_address) {
            device.name = device_board_name;
        }

        Self::save(&devices)
    }

    pub fn remove_device(mac_address: MacAddress) -> Result<()> {
        let mut devices = Self::get_stored_devices()?;

        devices.retain(|user| user.mac_address != mac_address);

        Self::save(&devices)
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


        Self::save(devices)
    }

    fn save(devices: &Vec<NintendoDevice>) -> Result<()> {
        let file_system_devices: Vec<FileSystemNintendoDevice> =
            devices.iter().map(|device| device.into()).collect();

        FileStore::save(Path::new(NINTENDO_DEVICES_FILE), &file_system_devices)
    }
}

const SETTINGS_FILE: &str = "settings.json";
pub struct SettingsFileSystem;
impl SettingsFileSystem {
    pub fn get_or_create_default_settings() -> Result<GeneralSettings> {
        let settings: GeneralSettings = FileStore::load_with_default(Path::new(SETTINGS_FILE))?;

        Ok(settings)
    }

    pub fn save_settings(settings: &GeneralSettings) -> Result<()> {
        let old_settings: GeneralSettings = FileStore::load_with_default(Path::new(SETTINGS_FILE))?;

        if old_settings == *settings {
            return Ok(());
        }

        FileStore::save(Path::new(SETTINGS_FILE), settings)
    }
}

const ACTIVITIES_FILE: &str = "activities.json";
pub struct ActivitiesFileSystem;
impl ActivitiesFileSystem {
    pub fn get_or_create_default_activities() -> Result<Vec<Activity>> {
        let activities: Vec<Activity> = FileStore::load_or_else(Path::new(ACTIVITIES_FILE), ActivityState::create_default_activities)?;
        Ok(activities)
    }

    pub fn save_activities(activities: &Vec<Activity>) -> Result<()> {
        let old_activities: Vec<Activity> = FileStore::load_with_default(Path::new(ACTIVITIES_FILE))?;

        if old_activities == *activities {
            return Ok(());
        }

        FileStore::save(Path::new(ACTIVITIES_FILE), activities)
    }
}

pub struct ExistingSessionFileSystem;
impl ExistingSessionFileSystem {
    pub fn load_latest_session_file(directory: &Path) -> Option<(String, SessionConfigurationFileFormat)> {
        let mut latest: Option<(NaiveDateTime, PathBuf)> = None;

        let paths = fs::read_dir(directory).context("Failed to read directory").ok()?;

        for entry in paths {
            let entry = entry.ok()?;
            let path = entry.path();

            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.ends_with(".settings.json") && name.starts_with("tbt-") {
                    // Extract the timestamp part: "2025-08-29T22-51-07"
                    if let Some(ts_str) = name.strip_prefix("tbt-")
                        .and_then(|s| s.strip_suffix(".settings.json")) {
                        // Parse with chrono
                        if let Ok(ts) = NaiveDateTime::parse_from_str(ts_str, "%Y-%m-%dT%H-%M-%S") {
                            match &latest {
                                Some((latest_ts, _)) if ts <= *latest_ts => {}
                                _ => latest = Some((ts, path.clone())),
                            }
                        }
                    }
                }
            }
        }

        println!("latest: #{:#?}", latest);

        if let Some((_, file_path)) = latest {
            match Self::load(&file_path) {
                Ok(session) => return Some((file_path.to_string_lossy().to_string(), session)),
                Err(e) => {
                    println!("Failed to load session file: {}", e);
                }
            }
        };

        None
    }
    pub fn load(file_path: &Path) -> Result<SessionConfigurationFileFormat> {
        FileStore::load(file_path)
    }

    pub fn save(file_path: &Path, session: &SessionConfigurationFileFormatRef) -> Result<()> {
        FileStore::save(file_path, session)
    }
}


// PRIMITIVES

struct FileStore;

impl FileStore {
    pub fn load<T>(file_name: &Path) -> Result<T>
    where
        T: Serialize + DeserializeOwned,
    {
        let file_path = app_dir().join(file_name);

        let file = File::open(&file_path)
            .with_context(|| format!("Failed to open file: {:?}", file_path))?;

        let reader = BufReader::new(file);

        let data: T = serde_json::from_reader(reader)
            .with_context(|| format!("Failed to parse JSON from file: {:?}", file_path))?;

        Ok(data)
    }

    pub fn load_with_default<T>(file_name: &Path) -> Result<T>
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

    pub fn load_or_else<T, F>(file_name: &Path, default_fn: F) -> Result<T>
    where
        T: Serialize + DeserializeOwned,
        F: FnOnce() -> T,
    {
        let file_path = app_dir().join(file_name);

        if !file_path.exists() {
            let defaults = default_fn();
            FileStore::save(file_name, &defaults)?;
            return Ok(defaults);
        }

        let file = File::open(&file_path)
            .with_context(|| format!("Failed to open file: {:?}", file_path))?;
        let reader = BufReader::new(file);

        let data = match serde_json::from_reader(reader) {
            Ok(data) => data,
            Err(e) if e.is_eof() => {
                let defaults = default_fn();
                FileStore::save(file_name, &defaults)?;
                defaults
            }
            Err(e) => return Err(e.into()),
        };

        Ok(data)
    }

    pub fn save<T>(file_name: &Path, data: T) -> Result<()>
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

fn app_dir_file(file_name: &Path) -> Result<File> {
    let file_path = app_dir().join(file_name);

    let file = File::create(file_path)
        .with_context(|| format!("Failed to open file: {}", file_name.to_string_lossy()))?;
    Ok(file)
}

pub fn app_dir() -> PathBuf {
    dirs::document_dir()
        .map(|path| path.join("the-balance-toolkit"))
        .expect("Could not access dir file")
}

pub fn session_dir() -> PathBuf {
    let app_dir = app_dir();
    app_dir.join("sessions")
}

fn save_into_file<T: Serialize>(file_name: &Path, data: T) -> anyhow::Result<()> {
    let file = app_dir_file(file_name)?;

    serde_json::to_writer_pretty(file, &data)
        .with_context(|| format!("Failed to save file: {}", file_name.to_string_lossy()))?;

    Ok(())
}
