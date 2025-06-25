mod file_system;
mod user;

use crate::file_system::FileSystem;
use crate::user::User;
use tauri_plugin_fs::FsExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // allowed the given directory
            let app_dir = FileSystem::app_dir();
            let scope = app.fs_scope();
            scope.allow_directory(app_dir, true)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            user_fetch_users,
            user_add,
            user_update,
            user_delete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

struct FileMetadata {
    file_name: String,
    user: u64,
    last_updated: String,
    file_path: String,
}

// USERS

#[tauri::command]
fn user_fetch_users() -> Result<Vec<User>, String> {
    FileSystem::get_users().map_err(|e| e.to_string())
}

#[tauri::command]
fn user_add(user: User) -> Result<(), String> {
    FileSystem::add_user(user).map_err(|e| e.to_string())
}

#[tauri::command]
fn user_update(user: User) -> Result<(), String> {
    FileSystem::update_user(user).map_err(|e| e.to_string())
}

#[tauri::command]
fn user_delete(user_id: String) -> Result<(), String> {
    FileSystem::remove_user(user_id).map_err(|e| e.to_string())
}
