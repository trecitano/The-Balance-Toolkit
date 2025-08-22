use std::fs::File;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::Duration;
use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use tokio::sync::mpsc;
use tokio::sync::mpsc::Sender;
use crate::actors::balance_board_actor::{BalanceBoardCalibratedReading, BalanceBoardCommands};
use crate::types::MacAddress;

pub fn initialize(mac_address: MacAddress, file_path: PathBuf) -> Result<Sender<BalanceBoardCommands>> {
    let (tx, rx) = mpsc::channel(100);

    thread::spawn(move || {
        blocking_file_reading_loop(mac_address, rx, file_path)
    });
    
    Ok(tx)
}

#[derive(Debug, Deserialize)]
struct CsvBalanceBoardRecord {
    timestamp: DateTime<Utc>, // parsed directly into chrono DateTime
    top_right: f32,
    bottom_right: f32,
    top_left: f32,
    bottom_left: f32,
}

fn blocking_file_reading_loop(
    mac_address: MacAddress,
    mut control_rx: mpsc::Receiver<BalanceBoardCommands>,
    file_path: PathBuf,
) -> Result<()> {
    let mut rdr: Option<csv::DeserializeRecordsIntoIter<File, CsvBalanceBoardRecord>> = None;
    let mut prev_time: Option<DateTime<Utc>> = None;
    let mut tx: Option<Sender<BalanceBoardCalibratedReading>> = None;

    loop {
        match control_rx.try_recv() {
            Ok(command) => {
                match command {
                    BalanceBoardCommands::TurnOnLed => { }
                    BalanceBoardCommands::TurnOffLed => { }
                    BalanceBoardCommands::ApplyTare => { }
                    BalanceBoardCommands::StartRecording(sender) => {
                        let reader = csv::ReaderBuilder::new()
                            .has_headers(true)
                            .from_path(file_path)?;
                        rdr = Some(reader.into_deserialize());
                        prev_time = None;
                        tx = Some(sender);
                    }
                    BalanceBoardCommands::FinishRecording => {
                        rdr = None;
                        tx = None;
                        prev_time = None;
                    }
                }
            }
            Err(mpsc::error::TryRecvError::Empty) => { }
            Err(mpsc::error::TryRecvError::Disconnected) => {
                println!("HID Loop: Control channel disconnected. Shutting down.");
                break;
            }
        }

        // 2. If file is being replayed, advance one record
        if let (Some(iter), Some(sender)) = (rdr.as_mut(), tx.as_ref()) {
            if let Some(result) = iter.next() {
                match result {
                    Ok(record) => {
                        // Sleep according to timestamp delta
                        if let Some(prev) = prev_time {
                            let delta = record.timestamp - prev;
                            let millis = delta.num_milliseconds().max(0);
                            thread::sleep(Duration::from_millis(millis as u64));
                        }

                        let reading = BalanceBoardCalibratedReading {
                            timestamp: record.timestamp,
                            mac_address,
                            top_right: record.top_right,
                            bottom_right: record.bottom_right,
                            top_left: record.top_left,
                            bottom_left: record.bottom_left,
                        };

                        // Try sending (non-async, so use blocking_send if needed)
                        if sender.blocking_send(reading).is_err() {
                            println!("Error sending file reading, stopping replay.");
                            rdr = None;
                            tx = None;
                            prev_time = None;
                        }

                        prev_time = Some(record.timestamp);
                    }
                    Err(e) => {
                        println!("CSV parse error: {:?}", e);
                        rdr = None;
                        tx = None;
                        prev_time = None;
                    }
                }
            } else {
                println!("File replay finished.");
                rdr = None;
                tx = None;
                prev_time = None;
            }
        }

        // 3. Small sleep to avoid busy loop when idle
        thread::sleep(Duration::from_millis(1));
    }

    println!("File reading complete HID loop terminated.");
    Ok(())
}