use anyhow::{Result, bail};
use clap::Subcommand;
use std::time::Duration;
use tokio::sync::mpsc;
use toolkit_core::actors::balance_board_actor::BoardAction;
use toolkit_core::actors::bluetooth_service::{BluetoothCommand, BluetoothPeripheral};
use toolkit_core::types::NintendoDevice;
use toolkit_core::utils::mac_address_human_name;
use toolkit_core::{ToolkitCommand, ToolkitResponse};

use crate::client::{Toolkit, resolve_board};
use crate::output::{Table, print_json};

#[derive(Subcommand)]
pub enum DevicesCommand {
    /// List every board the toolkit knows and whether it is connected right now.
    List,
    /// Pair new boards. Press the red SYNC button inside the board's battery compartment.
    Scan {
        /// Stop scanning after this many seconds instead of waiting for Ctrl-C.
        #[arg(long, value_name = "SECONDS")]
        timeout: Option<u64>,
    },
    /// Remove a board's pairing and forget it.
    Forget {
        /// Board name or MAC address (see `list`).
        board: String,
    },
    /// Blink a connected board's LED for about ten seconds to tell boards apart.
    Identify {
        /// Board name or MAC address (see `list`).
        board: String,
    },
    /// Give a board a name. Names appear in the desktop app and in recording file names.
    Rename {
        /// Board name or MAC address (see `list`).
        board: String,
        /// The new name.
        name: String,
    },
    /// Zero a connected board's sensors (with nothing on the board).
    Tare {
        /// Board name or MAC address (see `list`).
        board: String,
    },
}

pub async fn run(toolkit: &mut Toolkit, command: DevicesCommand, json: bool) -> Result<()> {
    match command {
        DevicesCommand::List => list(toolkit, json).await,
        DevicesCommand::Scan { timeout } => scan(toolkit, timeout, json).await,
        DevicesCommand::Forget { board } => forget(toolkit, &board).await,
        DevicesCommand::Identify { board } => identify(toolkit, &board).await,
        DevicesCommand::Rename { board, name } => rename(toolkit, &board, name).await,
        DevicesCommand::Tare { board } => tare(toolkit, &board).await,
    }
}

async fn list(toolkit: &Toolkit, json: bool) -> Result<()> {
    let boards = toolkit.boards().await?;
    print_boards(&boards, json)
}

fn print_boards(boards: &[NintendoDevice], json: bool) -> Result<()> {
    if json {
        return print_json(&boards);
    }
    if boards.is_empty() {
        println!("No boards known yet. Pair one with `tbt devices scan`.");
        return Ok(());
    }
    let mut table = Table::new(&["NAME", "MAC ADDRESS", "STATUS", "LAST SEEN"]);
    for board in boards {
        table.row(vec![
            board.name.clone(),
            mac_address_human_name(board.mac_address),
            if board.is_connected {
                "connected"
            } else {
                "offline"
            }
            .to_string(),
            board
                .last_connected
                .map(|t| t.format("%Y-%m-%d %H:%M UTC").to_string())
                .unwrap_or_else(|| "-".to_string()),
        ]);
    }
    table.print();
    Ok(())
}

async fn scan(toolkit: &mut Toolkit, timeout: Option<u64>, json: bool) -> Result<()> {
    // Same flow as the desktop app: Bluetooth pairing first, then the manager opens the
    // board over HID and reports it with `NewDeviceFound`.
    let (paired_tx, mut paired_rx) = mpsc::channel::<BluetoothPeripheral>(10);
    let commands = toolkit.commands.clone();
    tokio::spawn(async move {
        while let Some(peripheral) = paired_rx.recv().await {
            eprintln!(
                "Paired {} ({}), connecting...",
                peripheral.name,
                mac_address_human_name(peripheral.mac_address)
            );
            let command = ToolkitCommand::Connect {
                mac_address: peripheral.mac_address,
            };
            if commands.send(command).await.is_err() {
                break;
            }
        }
    });

    toolkit
        .request(|response| {
            ToolkitCommand::BluetoothAction(BluetoothCommand::StartScanAndPair {
                response_stream: paired_tx,
                response,
            })
        })
        .await?;

    eprintln!("Scanning for Wii Balance Boards.");
    eprintln!("Press the red SYNC button inside the battery compartment of each board.");
    match timeout {
        Some(seconds) => eprintln!("Scanning for {seconds}s. Press Ctrl-C to stop earlier."),
        None => eprintln!("Press Ctrl-C to stop."),
    }

    let ctrl_c = tokio::signal::ctrl_c();
    tokio::pin!(ctrl_c);
    let deadline = crate::live::deadline(timeout.map(Duration::from_secs));
    tokio::pin!(deadline);
    loop {
        tokio::select! {
            _ = &mut ctrl_c => break,
            _ = &mut deadline => {
                eprintln!("Scan time is up.");
                break;
            }
            event = toolkit.events.recv() => {
                if let Some(ToolkitResponse::NewDeviceFound(mac_address)) = event {
                    eprintln!("Connected {}.", mac_address_human_name(mac_address));
                }
            }
        }
    }

    toolkit
        .request(|response| {
            ToolkitCommand::BluetoothAction(BluetoothCommand::StopScan { response })
        })
        .await?;
    eprintln!();
    list(toolkit, json).await
}

async fn forget(toolkit: &Toolkit, reference: &str) -> Result<()> {
    let boards = toolkit.boards().await?;
    let board = resolve_board(&boards, reference)?;
    let mac_address = board.mac_address;
    let name = board.name.clone();
    toolkit
        .send(ToolkitCommand::BluetoothAction(
            BluetoothCommand::RemoveDevice { mac_address },
        ))
        .await?;
    toolkit.flush().await?;
    println!("Forgot {name} ({}).", mac_address_human_name(mac_address));
    Ok(())
}

async fn identify(toolkit: &Toolkit, reference: &str) -> Result<()> {
    let boards = toolkit.boards().await?;
    let board = resolve_board(&boards, reference)?;
    if !board.is_connected {
        bail!(
            "{} is not connected; only a connected board can blink.",
            board.name
        );
    }
    toolkit
        .send(ToolkitCommand::IdentifyBoard {
            mac_address: board.mac_address,
        })
        .await?;
    eprintln!("Blinking the LED of {}...", board.name);
    // The blink pattern runs inside the manager for about eleven seconds; stay alive for it.
    tokio::time::sleep(Duration::from_millis(11_500)).await;
    Ok(())
}

async fn rename(toolkit: &Toolkit, reference: &str, name: String) -> Result<()> {
    let boards = toolkit.boards().await?;
    let board = resolve_board(&boards, reference)?;
    let mac_address = board.mac_address;
    let old_name = board.name.clone();
    toolkit
        .send(ToolkitCommand::UpdateBoardName {
            mac_address,
            device_name: name.clone(),
        })
        .await?;
    toolkit.flush().await?;
    println!(
        "Renamed {old_name} ({}) to {name}.",
        mac_address_human_name(mac_address)
    );
    Ok(())
}

async fn tare(toolkit: &Toolkit, reference: &str) -> Result<()> {
    let boards = toolkit.boards().await?;
    let board = resolve_board(&boards, reference)?;
    if !board.is_connected {
        bail!(
            "{} is not connected; only a connected board can be tared.",
            board.name
        );
    }
    toolkit
        .send(ToolkitCommand::BoardAction {
            mac_address: board.mac_address,
            action: BoardAction::Tare,
        })
        .await?;
    toolkit.flush().await?;
    println!("Tared {}.", board.name);
    Ok(())
}
