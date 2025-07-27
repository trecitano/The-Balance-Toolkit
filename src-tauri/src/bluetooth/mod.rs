#[cfg(target_os = "linux")]
mod linux_bluetooth_service;
#[cfg(target_os = "windows")]
pub mod windows_bluetooth_service;
#[cfg(target_os = "macos")]
pub mod macos_bluetooth_service;