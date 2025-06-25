use crate::user::User;
use serde::{Deserialize, Serialize};
use std::{env, fs};
use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;

#[derive(Serialize, Deserialize)]
pub struct FileSystem;

#[derive(Serialize)]
pub struct FileMetadata {
    file_name: String,
    user: u64,
    last_updated: String,
    file_path: String,
}

impl FileSystem {
    pub fn get_users() -> anyhow::Result<Vec<User>> {
        let user_file = Self::app_dir_file("users.json")?;
        let reader = BufReader::new(user_file);
        let users = serde_json::from_reader(reader)?;

        Ok(users)
    }

    pub fn add_user(new_user: User) -> anyhow::Result<()> {
        let mut users = Self::get_users()?;

        users.push(new_user);

        let user_file = Self::get_user_file()?;
        Self::save_into_file(user_file, &users)
    }

    pub fn update_user(updated_user: User) -> anyhow::Result<()> {
        let mut users = Self::get_users()?;

        users.retain(|user| user.id != updated_user.id);
        users.push(updated_user);

        let user_file = Self::get_user_file()?;
        Self::save_into_file(user_file, &users)
    }

    pub fn remove_user(user_id: String) -> anyhow::Result<()> {
        let mut users = Self::get_users()?;

        users.retain(|user| user.id != user_id);

        let user_file = Self::get_user_file()?;
        Self::save_into_file(user_file, &users)
    }

    fn get_user_file() -> anyhow::Result<File> {
        Self::app_dir_file("users.json")
    }

    // PRIMITIVES

    fn app_dir_file(file_name: &str) -> anyhow::Result<File> {
        let file_path = Self::app_dir().join(file_name);

        println!("File path: {:?}", file_path);

        let file = File::create(file_path)?;
        Ok(file)
    }

    pub fn app_dir() -> PathBuf {
        dirs::data_dir()
            .map(|path| path.join("the-balance-toolkit"))
            .expect("Could not access dir file")
    }

    fn save_into_file<T: Serialize>(file: File, data: T) -> anyhow::Result<()> {
        //fs::create_dir_all(file.pa);
        let result = serde_json::to_writer_pretty(file, &data)?;
        print!("Result: {:?}", result);
        Ok(())
    }
}
