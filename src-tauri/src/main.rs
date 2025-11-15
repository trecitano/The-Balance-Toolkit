// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod actors;
mod bluetooth;
mod file_system;
mod types;
mod frontend;
mod processing;
mod utils;

use tokio::sync::mpsc;
use anyhow::Result;
use crate::actors::toolkit_service::ConnectionManager;

pub static NINTENDO_BOARD_ID: &str = "Nintendo RVL-WBC-01";

#[tokio::main]
async fn main() -> Result<()> {

}