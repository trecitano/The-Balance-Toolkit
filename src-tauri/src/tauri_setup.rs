use crate::file_system::FileSystem;
use crate::user::User;
use tauri_plugin_fs::FsExt;
use crate::bluetooth::bluetooth_communication;
use crate::bluetooth::bluetooth_communication::BluetoothAdapterInfo;

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
            user_fetch_all,
            user_add,
            user_update,
            user_delete,
            devices_fetch_all
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
fn user_fetch_all() -> Result<Vec<User>, String> {
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

// DEVICES

#[tauri::command]
fn devices_fetch_all() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
async fn devices_get_current_state() -> Result<Vec<anyhow::Result<BluetoothAdapterInfo>>, String> {
    bluetooth_communication::get_system_view().await.map_err(|e| e.to_string())
}

fn devices_remove(device_id: String) -> Result<(), String> {
    println!("Removing device: {}", device_id);
    Ok(())
}