use crate::actors::state::activities::{Activity, ActivityState};
use crate::processing::file_writer::SessionConfigurationFileFormat;
use crate::types::{GeneralSettings, MacAddress, NintendoDevice, User};
use anyhow::{Context, Result};
use chrono::{DateTime, NaiveDateTime, Utc};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::fs;
use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::sync::Arc;

const USERS_FILE: &str = "users.json";
pub struct UserFileSystem;
impl UserFileSystem {
    pub fn get_users() -> Result<Vec<User>> {
        let users: Vec<User> = FileStore::load_with_default(Path::new(USERS_FILE))?;
        Ok(users)
    }

    pub fn save(users: &Vec<Arc<User>>) -> Result<()> {
        FileStore::save(Path::new(USERS_FILE), users)
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
            last_connected: device.last_connected,
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
            last_connected: val.last_connected,
        }
    }
}

impl DeviceFileSystem {
    pub fn get_stored_devices() -> Result<Vec<NintendoDevice>> {
        let file_system_devices: Vec<FileSystemNintendoDevice> =
            FileStore::load_with_default(Path::new(NINTENDO_DEVICES_FILE))?;

        let devices = file_system_devices
            .into_iter()
            .map(|device| device.into())
            .collect();

        Ok(devices)
    }

    pub fn update_board_name(mac_address: MacAddress, device_board_name: String) -> Result<()> {
        let mut devices = Self::get_stored_devices()?;

        if let Some(device) = devices
            .iter_mut()
            .find(|device| device.mac_address == mac_address)
        {
            device.name = device_board_name;
        }

        Self::save(&devices)
    }

    pub fn remove_device(mac_address: MacAddress) -> Result<()> {
        let mut devices = Self::get_stored_devices()?;

        devices.retain(|user| user.mac_address != mac_address);

        Self::save(&devices)
    }

    pub fn update_file_system_boards(devices: &[NintendoDevice]) -> Result<()> {
        // Check if we really need to update the file system.
        // If the boards in the file system and in our argument are the same, we return.
        let file_system_devices = Self::get_stored_devices()?;

        let mut sorted_file_system = file_system_devices.clone();
        let mut sorted_devices = devices.to_vec();
        sorted_file_system.sort();
        sorted_devices.sort();

        if sorted_file_system == sorted_devices {
            return Ok(());
        }

        Self::save(devices)
    }

    fn save(devices: &[NintendoDevice]) -> Result<()> {
        let file_system_devices: Vec<FileSystemNintendoDevice> =
            devices.iter().map(|device| device.into()).collect();

        FileStore::save(Path::new(NINTENDO_DEVICES_FILE), &file_system_devices)
    }
}

const SETTINGS_FILE: &str = "settings.json";
pub struct SettingsFileSystem;
impl SettingsFileSystem {
    pub fn get_or_create_default_settings() -> Result<GeneralSettings> {
        FileStore::load_with_default(Path::new(SETTINGS_FILE))
    }

    pub fn save_settings(settings: &GeneralSettings) -> Result<()> {
        FileStore::save_if_changed(Path::new(SETTINGS_FILE), settings)
    }
}

const ACTIVITIES_FILE: &str = "activities.json";
pub struct ActivitiesFileSystem;
impl ActivitiesFileSystem {
    /// Loads the activities, writing the built-in defaults first if there is no file yet so
    /// the user has something to edit.
    pub fn get_or_create_default_activities() -> Result<Vec<Activity>> {
        let path = Path::new(ACTIVITIES_FILE);
        let activities: Vec<Activity> = FileStore::load_with_default(path)?;
        if activities.is_empty() {
            let defaults = ActivityState::create_default_activities();
            FileStore::save(path, &defaults)?;
            return Ok(defaults);
        }
        Ok(activities)
    }

    pub fn save_activities(activities: &Vec<Activity>) -> Result<()> {
        FileStore::save_if_changed(Path::new(ACTIVITIES_FILE), activities)
    }
}

pub struct ExistingSessionFileSystem;
impl ExistingSessionFileSystem {
    pub fn load_latest_session_file(
        directory: &Path,
    ) -> Option<(String, SessionConfigurationFileFormat)> {
        let mut latest: Option<(NaiveDateTime, PathBuf)> = None;

        let paths = fs::read_dir(directory)
            .context("Failed to read directory")
            .ok()?;

        for entry in paths {
            let entry = entry.ok()?;
            let path = entry.path();

            if let Some(name) = path.file_name().and_then(|n| n.to_str())
                && name.ends_with(".settings.json")
                && name.starts_with("tbt-")
            {
                // Extract the timestamp part: "2025-08-29T22-51-07"
                if let Some(ts_str) = name
                    .strip_prefix("tbt-")
                    .and_then(|s| s.strip_suffix(".settings.json"))
                {
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

        log::debug!("Latest session file: {:?}", latest);

        if let Some((_, file_path)) = latest {
            match Self::load(&file_path) {
                Ok(session) => return Some((file_path.to_string_lossy().to_string(), session)),
                Err(e) => {
                    log::warn!("Failed to load session file: {}", e);
                }
            }
        };

        None
    }
    pub fn load(file_path: &Path) -> Result<SessionConfigurationFileFormat> {
        FileStore::load(file_path)
    }

    pub fn save(file_path: &Path, session: &SessionConfigurationFileFormat) -> Result<()> {
        FileStore::save(file_path, session)
    }
}

// PRIMITIVES

/// JSON files under [`app_dir`]. Relative paths are resolved against it; absolute paths
/// (session files) are used as given.
struct FileStore;

impl FileStore {
    /// Loads a file that must exist.
    pub fn load<T: DeserializeOwned>(file_name: &Path) -> Result<T> {
        let file_path = app_dir().join(file_name);
        let file = File::open(&file_path)
            .with_context(|| format!("Failed to open file: {:?}", file_path))?;
        serde_json::from_reader(BufReader::new(file))
            .with_context(|| format!("Failed to parse JSON from file: {:?}", file_path))
    }

    /// Loads a file, or returns `T::default()` when it does not exist yet or is empty.
    pub fn load_with_default<T: DeserializeOwned + Default>(file_name: &Path) -> Result<T> {
        let file_path = app_dir().join(file_name);
        if !file_path.exists() {
            return Ok(T::default());
        }
        let file = File::open(&file_path)
            .with_context(|| format!("Failed to open file: {:?}", file_path))?;
        match serde_json::from_reader(BufReader::new(file)) {
            Ok(data) => Ok(data),
            Err(e) if e.is_eof() => Ok(T::default()),
            Err(e) => {
                Err(e).with_context(|| format!("Failed to parse JSON from file: {:?}", file_path))
            }
        }
    }

    pub fn save<T: Serialize>(file_name: &Path, data: T) -> Result<()> {
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

    /// Saves only when the content differs from what is on disk, sparing a rewrite (and a
    /// changed modification time) for a no-op update.
    pub fn save_if_changed<T>(file_name: &Path, data: &T) -> Result<()>
    where
        T: Serialize + DeserializeOwned + Default + PartialEq,
    {
        let current: T = Self::load_with_default(file_name)?;
        if current == *data {
            return Ok(());
        }
        Self::save(file_name, data)
    }
}

pub fn initialize_app_dir() -> Result<()> {
    let app_dir = app_dir();

    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)?;
    }

    Ok(())
}

/// Directory holding users, devices, settings, activities and (by default) sessions.
///
/// `TBT_APP_DIR` overrides the location outright, which lets a headless machine or a test
/// keep its data away from the user's documents. Otherwise it is `the-balance-toolkit` inside
/// the documents folder, falling back to the home directory on systems without one (a
/// server without `xdg-user-dirs`, for example).
pub fn app_dir() -> PathBuf {
    if let Some(dir) = std::env::var_os("TBT_APP_DIR").filter(|dir| !dir.is_empty()) {
        return PathBuf::from(dir);
    }
    dirs::document_dir()
        .or_else(dirs::home_dir)
        .map(|path| path.join("the-balance-toolkit"))
        .expect("Could not determine the application directory; set TBT_APP_DIR")
}

pub fn session_dir() -> PathBuf {
    let app_dir = app_dir();
    app_dir.join("sessions")
}
