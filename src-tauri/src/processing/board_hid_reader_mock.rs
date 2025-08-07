use std::thread;
use chrono::Utc;
use rand::Rng;
use tokio::sync::mpsc;
use tokio::sync::mpsc::Sender;
use crate::actors::balance_board_actor::{BalanceBoardCalibratedReading, BalanceBoardCommands};

pub fn initialize(device_serial_number: &str) -> anyhow::Result<Sender<BalanceBoardCommands>> {
    let (tx, rx) = mpsc::channel(100);

    let device_number_clone = device_serial_number.to_string();
    thread::spawn(move || {
        mock_hid_loop(rx, device_number_clone)
    });

    Ok(tx)
}

fn mock_hid_loop(mut hid_control_rx: mpsc::Receiver<BalanceBoardCommands>, device_serial_number: String) -> anyhow::Result<()> {
    let mut tx_channel: Option<mpsc::Sender<BalanceBoardCalibratedReading>> = None;
    let mut update_tare = false;
    let mut rng = rand::rng();

    loop {
        match hid_control_rx.try_recv() {
            Ok(command) => {
                println!("blocking hid: Got command: {:?}", command);
                match command {
                    BalanceBoardCommands::TurnOnLed => { /* No Action */ }
                    BalanceBoardCommands::TurnOffLed => { /* No Action */ }
                    BalanceBoardCommands::ApplyTare => { update_tare = true; }
                    BalanceBoardCommands::StartRecording(tx) => {
                        println!("Mock Board {} is starting the session!", device_serial_number);
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
                top_right: rng.random_range(15.0..25.0),
                bottom_right: rng.random_range(20.0..30.0),
                top_left: rng.random_range(20.0..30.0),
                bottom_left: rng.random_range(12.0..17.0),
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