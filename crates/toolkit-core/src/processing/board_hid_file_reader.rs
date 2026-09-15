use crate::actors::balance_board_actor::{BalanceBoardCalibratedReading, BoardAction};
use crate::processing::board_reader::{self, ReaderFailure, Sample, SampleSource};
use crate::types::MacAddress;
use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use std::fs::File;
use std::path::PathBuf;
use std::thread;
use std::time::Duration;
use tokio::sync::mpsc::Sender;

/// How long to wait between polls once a replay has finished or is not running.
const IDLE_INTERVAL: Duration = Duration::from_millis(200);

pub fn initialize(
    mac_address: MacAddress,
    file_path: PathBuf,
    failure_tx: Option<Sender<ReaderFailure>>,
) -> Result<Sender<BoardAction>> {
    log::info!(
        "File replay for {mac_address:012x}: {}",
        file_path.display()
    );
    board_reader::spawn(
        "board-replay",
        mac_address,
        FileBoard {
            mac_address,
            file_path,
            records: None,
            previous_timestamp: None,
        },
        failure_tx,
    )
}

#[derive(Debug, Deserialize)]
struct CsvBalanceBoardRecord {
    timestamp: DateTime<Utc>,
    top_right: f32,
    bottom_right: f32,
    top_left: f32,
    bottom_left: f32,
}

struct FileBoard {
    mac_address: MacAddress,
    file_path: PathBuf,
    records: Option<csv::DeserializeRecordsIntoIter<File, CsvBalanceBoardRecord>>,
    /// Timestamp of the last record replayed, used to pace playback at the recorded rate.
    previous_timestamp: Option<DateTime<Utc>>,
}

impl SampleSource for FileBoard {
    fn start(&mut self) -> Result<()> {
        let reader = csv::ReaderBuilder::new()
            .has_headers(true)
            .from_path(&self.file_path)?;
        self.records = Some(reader.into_deserialize());
        self.previous_timestamp = None;
        Ok(())
    }

    fn stop(&mut self) -> Result<()> {
        self.records = None;
        self.previous_timestamp = None;
        Ok(())
    }

    fn next_sample(&mut self) -> Result<Sample> {
        let Some(records) = self.records.as_mut() else {
            thread::sleep(IDLE_INTERVAL);
            return Ok(Sample::Idle);
        };

        let record = match records.next() {
            Some(Ok(record)) => record,
            Some(Err(e)) => {
                log::warn!("CSV parse error, stopping replay: {e:?}");
                return Ok(Sample::Finished);
            }
            None => return Ok(Sample::Finished),
        };

        if let Some(previous) = self.previous_timestamp {
            let millis = (record.timestamp - previous).num_milliseconds().max(0);
            thread::sleep(Duration::from_millis(millis as u64));
        }
        self.previous_timestamp = Some(record.timestamp);

        Ok(Sample::Reading(BalanceBoardCalibratedReading {
            timestamp: Utc::now(),
            mac_address: self.mac_address,
            top_right: record.top_right,
            bottom_right: record.bottom_right,
            top_left: record.top_left,
            bottom_left: record.bottom_left,
        }))
    }
}
