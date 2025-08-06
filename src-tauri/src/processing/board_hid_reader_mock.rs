use std::thread;
use chrono::Utc;
use tokio::sync::mpsc;
use tokio::sync::mpsc::Sender;
use crate::actors::balance_board_actor::{BalanceBoardCalibratedReading, BalanceBoardCommands};

pub fn initialize(_: &str) -> anyhow::Result<Sender<BalanceBoardCommands>> {
    let (tx, rx) = mpsc::channel(100);

    thread::spawn(move || {
        mock_hid_loop(rx)
    });

    Ok(tx)
}

fn mock_hid_loop(mut hid_control_rx: mpsc::Receiver<BalanceBoardCommands>) -> anyhow::Result<()> {
    let mut tx_channel: Option<mpsc::Sender<BalanceBoardCalibratedReading>> = None;
    let mut update_tare = false;

    loop {
        match hid_control_rx.try_recv() {
            Ok(command) => {
                println!("blocking hid: Got command: {:?}", command);
                match command {
                    BalanceBoardCommands::TurnOnLed => { /* No Action */ }
                    BalanceBoardCommands::TurnOffLed => { /* No Action */ }
                    BalanceBoardCommands::ApplyTare => { update_tare = true; }
                    BalanceBoardCommands::StartRecording(tx) => {
                        tx_channel = Some(tx);
                    },
                    BalanceBoardCommands::FinishRecording => {
                        tx_channel = None;
                    },
                }
            },
            Err(mpsc::error::TryRecvError::Empty) => { /* No command, continue */ },
            Err(mpsc::error::TryRecvError::Disconnected) => {
                // The async part has shut down. We must exit.
                println!("HID Loop: Control channel disconnected. Shutting down.");
                break;
            }
        }

        if let Some(tx) = &tx_channel {
            let mock_reading = BalanceBoardCalibratedReading {
                timestamp: Utc::now(),
                top_right: 0.4,
                bottom_right: 0.3,
                top_left: 0.2,
                bottom_left: 0.1,
            };
            tx.blocking_send(mock_reading)?;
            
            std::thread::sleep(std::time::Duration::from_millis(30));
        } else {
            // No session, sleep for a bit
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
        
    }
    
    println!("Mock HID loop terminated.");
    Ok(())
}