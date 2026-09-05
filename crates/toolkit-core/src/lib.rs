//! Core of The Balance Toolkit: Bluetooth pairing, HID board I/O, the session pipeline
//! (processing, CSV recording, TCP and LSL streaming) and replay of recorded sessions.
//!
//! The crate has no user interface of its own. A frontend (the Tauri desktop app or the
//! headless CLI) starts the [`ConnectionManager`] with [`start_manager`], sends it
//! [`ToolkitCommand`]s and listens for [`ToolkitResponse`] events.

pub mod actors;
pub mod bluetooth;
pub mod file_system;
pub mod processing;
pub mod types;
pub mod utils;

use anyhow::{Context, Result};
use tokio::sync::{mpsc, oneshot};

pub use actors::toolkit_service::{ConnectionManager, ToolkitCommand, ToolkitResponse};

/// Bluetooth device name reported by every Wii Balance Board.
pub static NINTENDO_BOARD_ID: &str = "Nintendo RVL-WBC-01";

/// Depth of the command queue between a frontend and the manager.
const COMMAND_QUEUE_DEPTH: usize = 100;

/// Creates the application directory, starts the [`ConnectionManager`] on the current tokio
/// runtime and returns the channels a frontend uses to talk to it.
///
/// The manager currently retains an internal command sender and lives with the runtime;
/// dropping a frontend's sender alone does not shut it down. Stop active sessions before
/// shutting down the runtime so their writers can finish.
/// Events the manager emits on its own (a board connecting, a session finishing) arrive on
/// the returned receiver; a frontend that is not interested must still drain or drop it.
pub fn start_manager() -> Result<(
    mpsc::Sender<ToolkitCommand>,
    mpsc::Receiver<ToolkitResponse>,
)> {
    file_system::initialize_app_dir().context("Failed to create the application directory")?;

    let (response_tx, response_rx) = mpsc::channel(COMMAND_QUEUE_DEPTH);
    let manager = ConnectionManager::new(response_tx)?;
    let command_tx = manager.get_sender_channel();
    tokio::spawn(async move {
        if let Err(e) = manager.run().await {
            log::error!("Connection manager stopped: {e:#}");
        }
    });

    Ok((command_tx, response_rx))
}

/// Sends one request/response command to the manager and waits for the reply.
///
/// `build` receives the oneshot sender to embed in the command, so callers only name the
/// variant: `request(&tx, |response| ToolkitCommand::GetSettings { response }).await`.
pub async fn request<T>(
    command_tx: &mpsc::Sender<ToolkitCommand>,
    build: impl FnOnce(oneshot::Sender<T>) -> ToolkitCommand,
) -> Result<T> {
    let (response_tx, response_rx) = oneshot::channel();
    command_tx
        .send(build(response_tx))
        .await
        .map_err(|_| anyhow::anyhow!("The toolkit manager is not running"))?;
    response_rx
        .await
        .map_err(|_| anyhow::anyhow!("The toolkit manager dropped the request"))
}

/// Sends a fire-and-forget command to the manager.
pub async fn send(
    command_tx: &mpsc::Sender<ToolkitCommand>,
    command: ToolkitCommand,
) -> Result<()> {
    command_tx
        .send(command)
        .await
        .map_err(|_| anyhow::anyhow!("The toolkit manager is not running"))
}

/// Minimal `log` backend writing to stderr. Level comes from `TBT_LOG` (error, warn, info,
/// debug, trace); the default is `debug` for development builds and `info` for release, so the
/// per-command traces cost nothing in production: `log` skips formatting for disabled levels.
struct StderrLogger;

impl log::Log for StderrLogger {
    fn enabled(&self, metadata: &log::Metadata) -> bool {
        metadata.level() <= log::max_level()
    }

    fn log(&self, record: &log::Record) {
        if self.enabled(record.metadata()) {
            eprintln!(
                "[{}] {}: {}",
                record.level(),
                record.target(),
                record.args()
            );
        }
    }

    fn flush(&self) {}
}

/// Installs the stderr logger. `default_level` applies when `TBT_LOG` is unset or invalid.
pub fn init_logging(default_level: log::LevelFilter) {
    let level = std::env::var("TBT_LOG")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(default_level);
    if log::set_logger(&StderrLogger).is_ok() {
        log::set_max_level(level);
    }
}

/// The logging default the desktop app has always used: `debug` in development, `info` in
/// release.
pub fn default_log_level() -> log::LevelFilter {
    if cfg!(debug_assertions) {
        log::LevelFilter::Debug
    } else {
        log::LevelFilter::Info
    }
}
