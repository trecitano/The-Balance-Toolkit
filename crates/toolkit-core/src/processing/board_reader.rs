//! The state machine shared by every board backend: which commands are honoured while
//! idle or recording, when the tare is captured, and how samples reach the pipeline.
//!
//! A backend only supplies the samples through [`SampleSource`]; the real HID board, the
//! demo generator and the CSV replay all run on top of the same [`run`] loop.

use crate::actors::balance_board_actor::{BalanceBoardCalibratedReading, BoardAction};
use crate::types::MacAddress;
use anyhow::Result;
use std::thread;
use tokio::sync::mpsc;
use tokio::sync::mpsc::Sender;

/// What a backend produced when asked for its next sample.
pub enum Sample {
    Reading(BalanceBoardCalibratedReading),
    /// Nothing right now. The backend must have waited or slept before returning this,
    /// otherwise the driver loop would spin.
    Idle,
    /// The source has no more samples for this recording (end of a replay file).
    Finished,
}

pub trait SampleSource: Send + 'static {
    /// Runs once on the reader thread before any command is handled.
    fn open(&mut self) -> Result<()> {
        Ok(())
    }
    fn set_led(&mut self, _on: bool) -> Result<()> {
        Ok(())
    }
    /// Recording is about to start.
    fn start(&mut self) -> Result<()> {
        Ok(())
    }
    /// Recording stopped, or the reader is shutting down.
    fn stop(&mut self) -> Result<()> {
        Ok(())
    }
    /// Next sample while recording. Must block or pace itself; see [`Sample::Idle`].
    fn next_sample(&mut self) -> Result<Sample>;
}

/// Spawns the reader thread for `source` and returns the channel the board actor talks to.
pub fn spawn<S: SampleSource>(
    name: &str,
    mac_address: MacAddress,
    source: S,
) -> Result<Sender<BoardAction>> {
    let (tx, rx) = mpsc::channel(100);
    let name = name.to_string();

    thread::Builder::new()
        .name(format!("{name}-{mac_address:012x}"))
        .spawn(move || {
            if let Err(e) = run(source, mac_address, rx) {
                log::error!("Error in {name} for {mac_address:012x}: {e:?}");
            }
        })?;

    Ok(tx)
}

fn run<S: SampleSource>(
    mut source: S,
    mac_address: MacAddress,
    mut control_rx: mpsc::Receiver<BoardAction>,
) -> Result<()> {
    source.open()?;

    let mut recording: Option<Sender<BalanceBoardCalibratedReading>> = None;
    // The tare is captured from the first sample after a `Tare` command and subtracted
    // from every sample afterwards. Until then it is all zeros.
    let mut capture_tare = false;
    let mut tare = BalanceBoardCalibratedReading::default();

    loop {
        // While recording, the source paces this loop, so commands are only polled. While
        // idle there is nothing to read, so block on the control channel instead.
        let command = if recording.is_some() {
            match control_rx.try_recv() {
                Ok(command) => Some(command),
                Err(mpsc::error::TryRecvError::Empty) => None,
                Err(mpsc::error::TryRecvError::Disconnected) => break,
            }
        } else {
            match control_rx.blocking_recv() {
                Some(command) => Some(command),
                None => break,
            }
        };

        if let Some(command) = command {
            log::debug!("Board {mac_address:012x}: got command {command:?}");
            match command {
                BoardAction::TurnOnLed => source.set_led(true)?,
                BoardAction::TurnOffLed => source.set_led(false)?,
                BoardAction::Tare => capture_tare = true,
                BoardAction::StartRecording(tx) => {
                    source.start()?;
                    recording = Some(tx);
                }
                BoardAction::StopRecording => {
                    recording = None;
                    source.stop()?;
                }
            }
        }

        let Some(tx) = &recording else { continue };

        match source.next_sample()? {
            Sample::Reading(reading) => {
                if capture_tare {
                    capture_tare = false;
                    tare = reading.clone();
                }
                if tx.blocking_send(reading.apply_tare(&tare)).is_err() {
                    log::debug!("Board {mac_address:012x}: consumer went away, stopping.");
                    recording = None;
                    source.stop()?;
                }
            }
            Sample::Idle => {}
            Sample::Finished => {
                log::info!("Board {mac_address:012x}: source finished.");
                recording = None;
                source.stop()?;
            }
        }
    }

    log::debug!("Board {mac_address:012x}: control channel closed, reader shutting down.");
    let _ = source.stop();
    Ok(())
}
