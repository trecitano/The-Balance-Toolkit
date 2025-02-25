#[cfg(target_os = "linux")]
mod linux_bluetooth_handler;
#[cfg(target_os = "windows")]
mod windows_bluetooth_handler;
pub mod bluetooth_communication;