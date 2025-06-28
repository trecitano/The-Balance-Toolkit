use crate::file_system::{DeviceFileSystem, UserFileSystem};
use crate::types::{NintendoDevice, User};
use tauri_plugin_fs::FsExt;
use crate::bluetooth::bluetooth_communication;
use crate::file_system;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // allowed the given directory
            let app_dir = file_system::app_dir();
            let scope = app.fs_scope();
            scope.allow_directory(app_dir, true)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            user_fetch_all,
            user_add,
            user_update,
            user_delete,
            //devices_fetch_all,
            devices_scan
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
    UserFileSystem::get_users().map_err(|e| e.to_string())
}

#[tauri::command]
fn user_add(user: User) -> Result<(), String> {
    UserFileSystem::add_user(user).map_err(|e| e.to_string())
}

#[tauri::command]
fn user_update(user: User) -> Result<(), String> {
    UserFileSystem::update_user(user).map_err(|e| e.to_string())
}

#[tauri::command]
fn user_delete(user_id: String) -> Result<(), String> {
    UserFileSystem::remove_user(user_id).map_err(|e| e.to_string())
}

// DEVICES

#[tauri::command(async)]
pub async fn devices_fetch_all() -> Result<Vec<NintendoDevice>, String> {
    let stored_devices = DeviceFileSystem::get_stored_devices().map_err(|e| e.to_string())?;
    let connected_devices: Vec<NintendoDevice> = bluetooth_communication::get_nintendo_devices()
        .await
        .map_err(|e| e.to_string())?
        .into_iter()
        .map(|p| p.into())
        .collect();

    // First we add all stored devices to the result,
    let mut result: Vec<NintendoDevice> = Vec::new();
    for device in stored_devices {
        result.push(device);
    }

    // Then we upsert the connected devices
    for device in connected_devices {
        match result.iter_mut().find(|d| d.mac_address == device.mac_address) {
            Some(found) => found.last_seen = None,
            None => result.push(device)
        }
    }

    println!("Returning devices: #{:?}", result);

    Ok(result)
}

#[tauri::command(async)]
async fn devices_scan() {
    //tokio::spawn(async {
        bluetooth_communication::ensure_balance_board_is_connected().await;
    //});
}

/*
#[tauri::command]
pub async fn cancel_scan(state: State<'_, AppState>) -> Result<(), String> {
    let mut scan_state = state.scan_state.lock().await;

    if let Some(handle) = scan_state.handle.take() {
        println!("Cancelling scan...");
        handle.abort();
        println!("Scan cancelled.");
        Ok(())
    } else {
        Err("No scan is currently in progress.".to_string())
    }
}
*/

fn devices_remove(device_id: String) -> Result<(), String> {
    println!("Removing device: {}", device_id);
    Ok(())
}

