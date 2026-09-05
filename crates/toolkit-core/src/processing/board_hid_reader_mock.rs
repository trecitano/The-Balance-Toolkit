use crate::actors::balance_board_actor::{BalanceBoardCalibratedReading, BalanceBoardCommands};
use crate::types::MacAddress;
use chrono::{DateTime, Utc};
use rand::{RngExt, SeedableRng, rngs::StdRng};
use std::thread;
use tokio::sync::mpsc;
use tokio::sync::mpsc::Sender;

pub fn initialize(mac_address: MacAddress) -> anyhow::Result<Sender<BalanceBoardCommands>> {
    let (tx, rx) = mpsc::channel(100);

    thread::spawn(move || {
        if let Err(e) = mock_hid_loop(rx, mac_address) {
            log::error!("Error in Board Hid Reader Mock: {:?}", e);
        }
    });

    Ok(tx)
}

fn mock_hid_loop(
    mut hid_control_rx: mpsc::Receiver<BalanceBoardCommands>,
    mac_address: MacAddress,
) -> anyhow::Result<()> {
    let mut tx_channel: Option<mpsc::Sender<BalanceBoardCalibratedReading>> = None;
    let mut update_tare = false;
    let mut tare_value = BalanceBoardCalibratedReading {
        timestamp: Utc::now(),
        mac_address: 0,
        top_right: 0.0,
        top_left: 0.0,
        bottom_right: 0.0,
        bottom_left: 0.0,
    };
    let mut generator: Option<MockBoardGen> = None;

    log::info!("Mock HID loop starting.");

    loop {
        match hid_control_rx.try_recv() {
            Ok(command) => {
                log::debug!("Mock HID loop: got command {:?}", command);
                match command {
                    BalanceBoardCommands::TurnOnLed => { /* No Action */ }
                    BalanceBoardCommands::TurnOffLed => { /* No Action */ }
                    BalanceBoardCommands::ApplyTare => {
                        update_tare = true;
                    }
                    BalanceBoardCommands::StartRecording(tx) => {
                        log::info!("Mock Board {} is starting the session!", mac_address);
                        tx_channel = Some(tx);
                        generator = Some(MockBoardGen::new_random(mac_address));
                    }
                    BalanceBoardCommands::FinishRecording => {
                        log::info!("Mock Board {} has stopped the session.", mac_address);
                        tx_channel = None;
                        generator = None;
                    }
                }
            }
            Err(mpsc::error::TryRecvError::Empty) => { /* No command, continue */ }
            Err(mpsc::error::TryRecvError::Disconnected) => {
                // The async part has shut down. We must exit.
                log::info!("HID Mock Reader disconnected. Shutting down.");
                break;
            }
        }

        if let (Some(tx), Some(mock_generator)) = (&tx_channel, &mut generator) {
            let mock_reading = mock_generator.next();

            if update_tare {
                update_tare = false;
                tare_value = mock_reading.clone();
            }

            let tared_reading = BalanceBoardCalibratedReading {
                timestamp: mock_reading.timestamp,
                mac_address: mock_reading.mac_address,
                top_right: mock_reading.top_right - tare_value.top_right,
                top_left: mock_reading.top_left - tare_value.top_left,
                bottom_right: mock_reading.bottom_right - tare_value.bottom_right,
                bottom_left: mock_reading.bottom_left - tare_value.bottom_left,
            };

            tx.blocking_send(tared_reading)?;

            std::thread::sleep(std::time::Duration::from_millis(10));
        } else {
            // No session, sleep for a bit
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
    }

    log::info!("Mock HID loop terminated.");
    Ok(())
}

use std::f32::consts::PI;
use std::time::Instant;

pub struct MockBoardGen {
    mac: MacAddress,
    start: Instant,
    // Randomized once per board/session
    radius_x: f32,   // <= X_HALF_MM
    radius_y: f32,   // <= Y_HALF_MM
    omega: f32,      // rad/s (2π * revs_per_sec)
    base_force: f32, // total baseline force over 4 corners
    vert_amp: f32,   // fraction (e.g., 0.05 = ±5%)
    phase0: f32,     // initial phase
}

impl MockBoardGen {
    pub fn new_random(mac: MacAddress) -> Self {
        Self::from_rng(mac, &mut rand::rng())
    }

    /// Repeatable board parameters for fixtures and tests. Use `sample_at` to control time.
    pub fn seeded(mac: MacAddress, seed: u64) -> Self {
        Self::from_rng(mac, &mut StdRng::seed_from_u64(seed))
    }

    fn from_rng(mac: MacAddress, rng: &mut impl rand::Rng) -> Self {
        // Choose radii inside support polygon
        let rx_frac = rng.random_range(0.35f32..0.65);
        let ry_frac = rng.random_range(0.35f32..0.70);

        // 0.3–0.6 rev/s looks like a slow walk path around an ellipse
        let revs_per_sec = rng.random_range(0.10f32..1.0);
        let omega = 2.0 * PI * revs_per_sec;

        // Keep total force near your old per-corner ranges (10..50 each)
        // Base total around 4 * 25 = 100, with some spread
        let per_corner = rng.random_range(20.0f32..45.0);
        let base_force = 4.0 * per_corner;

        // Small vertical modulation (2 peaks per revolution)
        let vert_amp = rng.random_range(0.03f32..0.08);

        let phase0 = rng.random_range(0.0f32..(2.0 * PI));

        Self {
            mac,
            start: Instant::now(),
            radius_x: rx_frac * 220.0, // TODO FIX
            radius_y: ry_frac * 60.0,  // TODO FIX
            omega,
            base_force,
            vert_amp,
            phase0,
        }
    }

    pub fn next(&self) -> BalanceBoardCalibratedReading {
        self.sample_at(self.start.elapsed(), Utc::now())
    }

    /// Sample at an explicit elapsed time and timestamp, without sleeping or reading a clock.
    pub fn sample_at(
        &self,
        elapsed: std::time::Duration,
        timestamp: DateTime<Utc>,
    ) -> BalanceBoardCalibratedReading {
        let t = elapsed.as_secs_f32();
        let phase = self.phase0 + self.omega * t;

        // CCW path: x = cos, y = sin
        let x = self.radius_x * phase.cos();
        let y = self.radius_y * phase.sin();

        // Optional vertical oscillation (2x frequency)
        let total_force = self.base_force * (1.0 + self.vert_amp * (2.0 * phase).sin());

        let (top_right, bottom_right, top_left, bottom_left) = reading_from_cop(x, y, total_force);

        BalanceBoardCalibratedReading {
            timestamp,
            mac_address: self.mac,
            top_right,
            bottom_right,
            top_left,
            bottom_left,
        }
    }
}

fn reading_from_cop(x: f32, y: f32, total_force: f32) -> (f32, f32, f32, f32) {
    // Bilinear distribution keeps corners >= 0 for |x| <= X_HALF_MM, |y| <= Y_HALF_MM
    let xn = (x / 300.0).clamp(-1.0, 1.0);
    let yn = (y / 200.0).clamp(-1.0, 1.0);

    let w = 0.25 * total_force;

    let tr = w * (1.0 + xn) * (1.0 + yn);
    let tl = w * (1.0 - xn) * (1.0 + yn);
    let br = w * (1.0 + xn) * (1.0 - yn);
    let bl = w * (1.0 - xn) * (1.0 - yn);

    (tr, br, tl, bl)
}
