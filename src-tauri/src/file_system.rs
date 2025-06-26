use crate::user::User;
use serde::{Deserialize, Serialize};
use std::{env, fs};
use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;
use anyhow::Context;

#[derive(Serialize, Deserialize)]
pub struct FileSystem;

#[derive(Serialize)]
pub struct FileMetadata {
    file_name: String,
    user: u64,
    last_updated: String,
    file_path: String,
}

const USERS_FILE: &str = "users.json";

impl FileSystem {
    pub fn get_users() -> anyhow::Result<Vec<User>> {
        let file_path = Self::app_dir().join(USERS_FILE);

        if !file_path.exists() {
            return Ok(Vec::new());
        }

        let file = File::open(&file_path)
            .with_context(|| format!("Failed to open file for reading: {:?}", file_path))?;

        let reader = BufReader::new(file);
        let users = match serde_json::from_reader(reader) {
            Ok(users) => users,
            Err(e) if e.is_eof() => Vec::new(),
            Err(e) => return Err(e.into()),
        };

        Ok(users)
    }

    pub fn add_user(new_user: User) -> anyhow::Result<()> {
        let mut users = Self::get_users()?;

        users.push(new_user);

        Self::save_into_file(USERS_FILE, &users)
    }

    pub fn update_user(updated_user: User) -> anyhow::Result<()> {
        let mut users = Self::get_users()?;

        users.retain(|user| user.id != updated_user.id);
        users.push(updated_user);

        Self::save_into_file(USERS_FILE, &users)
    }

    pub fn remove_user(user_id: String) -> anyhow::Result<()> {
        let mut users = Self::get_users()?;

        users.retain(|user| user.id != user_id);

        Self::save_into_file(USERS_FILE, &users)
    }

    // PRIMITIVES

    pub fn initialize_app_dir() -> anyhow::Result<()> {
        let app_dir = Self::app_dir();

        if !app_dir.exists() {
            fs::create_dir_all(&app_dir)?;
        }
        
        Ok(())
    }

    fn app_dir_file(file_name: &str) -> anyhow::Result<File> {
        let file_path = Self::app_dir().join(file_name);

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
        let file = Self::app_dir_file(file_name)?;

        serde_json::to_writer_pretty(file, &data)
            .with_context(|| format!("Failed to save file: {}", file_name))?;

        Ok(())
    }
}
