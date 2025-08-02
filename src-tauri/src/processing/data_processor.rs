use anyhow::Result;
use chrono::Utc;
use serde::Serialize;
use tokio::sync::{broadcast, mpsc};
use tokio::task;
use crate::processing::board_hid_reader::BalanceBoardCalibratedReading;

#[derive(Serialize, Debug, Clone, Copy)]
pub struct ProcessedBoardData {
    pub timestamp: chrono::DateTime<Utc>,
    pub raw_reading: BalanceBoardCalibratedReading,
    pub reading: [f32; 4],
}

impl ProcessedBoardData {
    pub fn to_byte_array(&self) -> [u8; 24] {
        let mut buf = [0u8; 24];

        // 1. Serialize the timestamp (8 bytes)
        let timestamp_nanos = self.timestamp.timestamp_nanos_opt().unwrap_or(0);
        buf[0..8].copy_from_slice(&timestamp_nanos.to_be_bytes());

        // 2. Serialize the f32 readings (16 bytes)
        let mut offset = 8;
        for &value in self.reading.iter() {
            buf[offset..offset + 4].copy_from_slice(&value.to_be_bytes());
            offset += 4;
        }

        buf
    }
}

pub fn initialize(rx: mpsc::Receiver<BalanceBoardCalibratedReading>, 
                  tx: broadcast::Sender<ProcessedBoardData>) -> task::JoinHandle<Result<()>> {
    tokio::spawn(async move {
        data_process_loop(rx, tx).await
    })
}

async fn data_process_loop(
    mut rx: mpsc::Receiver<BalanceBoardCalibratedReading>,
    tx: broadcast::Sender<ProcessedBoardData>,
) -> Result<()> {
    println!("Starting Data Process!");
    loop {
        println!("Data process loop");
        match rx.recv().await {
            Some(data) => {

                let center_of_pressure_x =
                    216.5 * // Distance between force transducer (433 mm) / 2
                        (data.top_right + data.bottom_right) - (data.top_left + data.bottom_left) /
                        (data.top_right + data.bottom_right + data.top_left + data.bottom_left);

                let center_of_pressure_y =
                    119.0 * // Distance between force transducer (238 mm)
                        (data.top_right + data.top_left) - (data.bottom_right + data.bottom_left) /
                        (data.top_right + data.bottom_right + data.top_left + data.bottom_left);

                let timestamp = Utc::now();
                let reading: [f32; 4] = [
                    data.top_right,
                    data.bottom_right,
                    data.top_left,
                    data.bottom_left,
                ];

                match tx.send(ProcessedBoardData { raw_reading: data, timestamp, reading} ) {
                    Ok(_) => (),
                    Err(e) => {
                        println!("Temporary log: disconnected: {}", e); // TODO
                        break;
                    }
                }
            }
            None => break
        }
    }
    println!("Data processing loop terminated.");
    Ok(())
}