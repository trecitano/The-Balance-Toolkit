// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod frontend;

use anyhow::Result;

#[tokio::main]
async fn main() -> Result<()> {
    toolkit_core::init_logging(toolkit_core::default_log_level());

    #[cfg(target_os = "linux")]
    enforce_working_locale();

    // Startup: a single manager holds all state and runs in the background. The Tauri
    // commands send it messages and it replies over oneshot channels; see `toolkit_core`.
    let (manager_command_tx, manager_response_rx) = toolkit_core::start_manager()?;

    frontend::tauri::initialize(manager_command_tx, manager_response_rx);
    Ok(())
}

// Need to enforce a backup locale for uPlot, in case the operating sytem doesn't have one defined
#[cfg(target_os = "linux")]
fn enforce_working_locale() {
    const FALLBACK: &str = "en_US.UTF-8";
    let needs_fix = |v: &str| matches!(v, "" | "C" | "POSIX");

    for var in ["LANGUAGE", "LC_ALL", "LC_MESSAGES", "LANG"] {
        let val = std::env::var(var).unwrap_or_default();
        if needs_fix(&val) {
            unsafe { std::env::set_var(var, FALLBACK) };
        }
    }
}
