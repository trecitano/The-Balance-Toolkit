//! The state machine shared by every board backend: which commands are honoured while
//! idle or recording, when the tare is captured, and how samples reach the pipeline.
//!
//! A backend only supplies the samples through [`SampleSource`]; the real HID board, the
//! demo generator and the CSV replay all run on top of the same [`run`] loop.

use crate::actors::balance_board_actor::{BalanceBoardCalibratedReading, BoardAction};
use crate::types::MacAddress;
use anyhow::{Context, Result};
use std::thread;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::sync::mpsc::Sender;

/// How many `next_sample` errors in a row the reader tolerates before giving up. A real
/// board drops single HID reads now and then (the Linux hid-wiimote driver resets the
/// report mode every ~30 s, for one), which must not end the connection.
const MAX_CONSECUTIVE_READ_FAILURES: u32 = 10;
/// Pause after a failed read so a backend that fails immediately cannot spin.
const READ_FAILURE_PAUSE: Duration = Duration::from_millis(100);

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

/// Why a reader stopped on its own. Sent once, only when the reader gave up on its board:
/// a reader shut down by dropping its control channel goes quietly, since whoever dropped
/// the channel already knows.
#[derive(Debug)]
pub struct ReaderFailure {
    pub mac_address: MacAddress,
    pub error: anyhow::Error,
}

/// Spawns the reader thread for `source` and returns the channel the board actor talks to.
/// `failure_tx`, when given, is told if the reader exits because of an error.
pub fn spawn<S: SampleSource>(
    name: &str,
    mac_address: MacAddress,
    source: S,
    failure_tx: Option<Sender<ReaderFailure>>,
) -> Result<Sender<BoardAction>> {
    let (tx, rx) = mpsc::channel(100);
    let name = name.to_string();

    thread::Builder::new()
        .name(format!("{name}-{mac_address:012x}"))
        .spawn(move || {
            if let Err(error) = run(source, mac_address, rx) {
                log::error!("Error in {name} for {mac_address:012x}: {error:?}");
                if let Some(failure_tx) = failure_tx {
                    let _ = failure_tx.blocking_send(ReaderFailure { mac_address, error });
                }
            }
        })?;

    Ok(tx)
}

fn run<S: SampleSource>(
    mut source: S,
    mac_address: MacAddress,
    mut control_rx: mpsc::Receiver<BoardAction>,
) -> Result<()> {
    source.open().context("Failed to open the board")?;

    let mut recording: Option<Sender<BalanceBoardCalibratedReading>> = None;
    // The tare is captured from the first sample after a `Tare` command and subtracted
    // from every sample afterwards. Until then it is all zeros.
    let mut capture_tare = false;
    let mut tare = BalanceBoardCalibratedReading::default();
    let mut consecutive_read_failures = 0u32;

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
                // A missed LED write is cosmetic; it must not take the board down.
                BoardAction::TurnOnLed => warn_on_error(mac_address, "LED", source.set_led(true)),
                BoardAction::TurnOffLed => warn_on_error(mac_address, "LED", source.set_led(false)),
                BoardAction::Tare => capture_tare = true,
                BoardAction::StartRecording(tx) => {
                    source
                        .start()
                        .context("Failed to start reading from the board")?;
                    recording = Some(tx);
                    consecutive_read_failures = 0;
                }
                BoardAction::StopRecording => {
                    recording = None;
                    warn_on_error(mac_address, "stop", source.stop());
                }
            }
        }

        let Some(tx) = &recording else { continue };

        let sample = match source.next_sample() {
            Ok(sample) => {
                consecutive_read_failures = 0;
                sample
            }
            Err(error) => {
                consecutive_read_failures += 1;
                if consecutive_read_failures >= MAX_CONSECUTIVE_READ_FAILURES {
                    return Err(error.context(format!(
                        "{consecutive_read_failures} consecutive read failures; giving up on the board"
                    )));
                }
                log::warn!(
                    "Board {mac_address:012x}: read failed ({consecutive_read_failures}/{MAX_CONSECUTIVE_READ_FAILURES}): {error:#}"
                );
                thread::sleep(READ_FAILURE_PAUSE);
                continue;
            }
        };

        match sample {
            Sample::Reading(reading) => {
                if capture_tare {
                    capture_tare = false;
                    tare = reading.clone();
                }
                if tx.blocking_send(reading.apply_tare(&tare)).is_err() {
                    log::debug!("Board {mac_address:012x}: consumer went away, stopping.");
                    recording = None;
                    warn_on_error(mac_address, "stop", source.stop());
                }
            }
            Sample::Idle => {}
            Sample::Finished => {
                log::info!("Board {mac_address:012x}: source finished.");
                recording = None;
                warn_on_error(mac_address, "stop", source.stop());
            }
        }
    }

    log::debug!("Board {mac_address:012x}: control channel closed, reader shutting down.");
    let _ = source.stop();
    Ok(())
}

fn warn_on_error(mac_address: MacAddress, what: &str, result: Result<()>) {
    if let Err(error) = result {
        log::warn!("Board {mac_address:012x}: {what} command failed: {error:#}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use anyhow::anyhow;
    use std::sync::Arc;
    use std::sync::atomic::{AtomicBool, Ordering};

    /// Fails the first `failures_before_success` reads of every recording, then yields a
    /// reading per call. `stopped` records that `stop` ran.
    struct FlakySource {
        failures_before_success: u32,
        failures_so_far: u32,
        stopped: Arc<AtomicBool>,
    }

    impl SampleSource for FlakySource {
        fn next_sample(&mut self) -> Result<Sample> {
            if self.failures_so_far < self.failures_before_success {
                self.failures_so_far += 1;
                return Err(anyhow!("read failed"));
            }
            thread::sleep(Duration::from_millis(5));
            Ok(Sample::Reading(BalanceBoardCalibratedReading {
                mac_address: 7,
                top_right: 1.0,
                ..Default::default()
            }))
        }

        fn stop(&mut self) -> Result<()> {
            self.stopped.store(true, Ordering::SeqCst);
            Ok(())
        }
    }

    fn start(source: FlakySource) -> (Sender<BoardAction>, mpsc::Receiver<ReaderFailure>) {
        let (failure_tx, failure_rx) = mpsc::channel(1);
        let control = spawn("test", 7, source, Some(failure_tx)).unwrap();
        (control, failure_rx)
    }

    #[tokio::test]
    async fn transient_read_errors_do_not_end_the_recording() {
        let stopped = Arc::new(AtomicBool::new(false));
        let (control, mut failure_rx) = start(FlakySource {
            failures_before_success: MAX_CONSECUTIVE_READ_FAILURES - 1,
            failures_so_far: 0,
            stopped: stopped.clone(),
        });
        let (data_tx, mut data_rx) = mpsc::channel(4);
        control
            .send(BoardAction::StartRecording(data_tx))
            .await
            .unwrap();

        let reading = tokio::time::timeout(Duration::from_secs(5), data_rx.recv())
            .await
            .expect("reader recovered and produced a sample")
            .unwrap();
        assert_eq!(reading.top_right, 1.0);
        assert!(failure_rx.try_recv().is_err());
        assert!(!control.is_closed());

        drop(control);
        tokio::time::timeout(Duration::from_secs(5), async {
            while !stopped.load(Ordering::SeqCst) {
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .expect("dropping the control channel shuts the reader down");
        assert!(
            failure_rx.recv().await.is_none(),
            "a clean shutdown is not a failure"
        );
    }

    #[tokio::test]
    async fn persistent_read_errors_report_a_failure_and_close_the_channel() {
        let (control, mut failure_rx) = start(FlakySource {
            failures_before_success: u32::MAX,
            failures_so_far: 0,
            stopped: Arc::new(AtomicBool::new(false)),
        });
        let (data_tx, mut data_rx) = mpsc::channel(4);
        control
            .send(BoardAction::StartRecording(data_tx))
            .await
            .unwrap();

        let failure = tokio::time::timeout(Duration::from_secs(10), failure_rx.recv())
            .await
            .expect("reader gave up")
            .unwrap();
        assert_eq!(failure.mac_address, 7);
        assert!(
            failure
                .error
                .to_string()
                .contains("consecutive read failures")
        );
        assert!(
            data_rx.recv().await.is_none(),
            "the recording channel closes"
        );
        assert!(control.is_closed());
    }
}
