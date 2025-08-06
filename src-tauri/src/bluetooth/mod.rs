#[cfg(all(target_os = "linux", not(feature = "mock")))]
mod linux_bluetooth_service;
#[cfg(all(target_os = "windows", not(feature = "mock")))]
pub mod windows_bluetooth_service;
#[cfg(all(target_os = "macos", not(feature = "mock")))]
pub mod macos_bluetooth_service;
#[cfg(feature = "mock")]
pub mod bluetooth_service_mock;