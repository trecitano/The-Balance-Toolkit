//! Live view of a running session or replay: a refreshing status line per board, or one JSON
//! object per sample on stdout for piping into other tools.

use clap::ValueEnum;
use serde_json::json;
use std::collections::{BTreeMap, HashMap};
use std::io::{IsTerminal, Write};
use std::time::{Duration, Instant};
use toolkit_core::actors::balance_board_actor::BalanceBoardOutput;
use toolkit_core::types::{MacAddress, SessionActivityState};
use toolkit_core::utils::mac_address_human_name;

use crate::output::format_clock;

#[derive(Copy, Clone, Debug, PartialEq, Eq, ValueEnum)]
pub enum LiveMode {
    /// One status line per board, refreshed in place (once a second when not on a terminal).
    Status,
    /// Every raw and processed sample as a JSON object per line on stdout (JSON Lines).
    Samples,
    /// Print nothing while running.
    None,
}

#[derive(Default)]
struct BoardStatus {
    raw_samples: u64,
    processed_samples: u64,
    weight_kg: f32,
    cop_x: f32,
    cop_y: f32,
    stability_index: Option<f32>,
    dpsi: Option<f32>,
}

pub struct LiveMonitor {
    mode: LiveMode,
    names: HashMap<MacAddress, String>,
    boards: BTreeMap<MacAddress, BoardStatus>,
    activity: Option<String>,
    started: Instant,
    last_print: Option<Instant>,
    is_tty: bool,
    printed_in_place: bool,
}

impl LiveMonitor {
    pub fn new(mode: LiveMode, mut names: HashMap<MacAddress, String>) -> Self {
        disambiguate(&mut names);
        let mut boards = BTreeMap::new();
        for &mac_address in names.keys() {
            boards.insert(mac_address, BoardStatus::default());
        }
        Self {
            mode,
            names,
            boards,
            activity: None,
            started: Instant::now(),
            last_print: None,
            is_tty: std::io::stderr().is_terminal(),
            printed_in_place: false,
        }
    }

    pub fn record(&mut self, output: &BalanceBoardOutput) {
        if self.mode == LiveMode::Samples {
            self.print_sample(output);
        }
        let status = self.boards.entry(output.mac_address()).or_default();
        match output {
            BalanceBoardOutput::Raw(reading) => {
                let cop = reading.calculate_cop();
                status.raw_samples += 1;
                status.weight_kg = reading.top_left
                    + reading.top_right
                    + reading.bottom_left
                    + reading.bottom_right;
                status.cop_x = cop.x;
                status.cop_y = cop.y;
            }
            BalanceBoardOutput::Processed(data) => {
                status.processed_samples += 1;
                status.stability_index = data.stability_index;
                status.dpsi = data.dpsi_metrics.as_ref().map(|m| m.dpsi);
            }
        }
    }

    pub fn set_activity(&mut self, state: Option<&SessionActivityState>) {
        self.activity = state.and_then(|state| {
            let ongoing = state.ongoing_state.as_ref()?;
            let block = state
                .activity
                .timeline_blocks
                .get(ongoing.current_block_index as usize)?;
            Some(format!(
                "{} ({}s left, loop {}/{})",
                block.title,
                (ongoing.time_to_next_block_ms as f64 / 1000.0).ceil() as i64,
                ongoing.loop_number + 1,
                state.activity.loops
            ))
        });
    }

    /// Redraws the status line. Call it on a short interval; it rate-limits itself.
    pub fn tick(&mut self) {
        if self.mode != LiveMode::Status {
            return;
        }
        let min_interval = if self.is_tty {
            Duration::from_millis(250)
        } else {
            Duration::from_secs(1)
        };
        if self
            .last_print
            .is_some_and(|last| last.elapsed() < min_interval)
        {
            return;
        }
        self.last_print = Some(Instant::now());

        let line = self.status_line();
        let mut stderr = std::io::stderr().lock();
        if self.is_tty {
            // Clear the line and redraw in place.
            let _ = write!(stderr, "\r\x1b[2K{line}");
            self.printed_in_place = true;
        } else {
            let _ = writeln!(stderr, "{line}");
        }
        let _ = stderr.flush();
    }

    /// Ends the in-place line so later output starts on a fresh line.
    pub fn finish(&mut self) {
        if self.printed_in_place {
            eprintln!();
            self.printed_in_place = false;
        }
    }

    pub fn total_raw_samples(&self) -> u64 {
        self.boards.values().map(|b| b.raw_samples).sum()
    }

    fn status_line(&self) -> String {
        let mut parts = Vec::new();
        for (mac_address, status) in &self.boards {
            let name = self.board_name(*mac_address);
            let mut part = format!(
                "{name}: {:.1} kg  CoP ({:+.2}, {:+.2})",
                status.weight_kg, status.cop_x, status.cop_y
            );
            if let Some(si) = status.stability_index {
                part.push_str(&format!("  SI {si:.2}"));
            }
            if let Some(dpsi) = status.dpsi {
                part.push_str(&format!("  DPSI {dpsi:.2}"));
            }
            part.push_str(&format!("  n={}", status.raw_samples));
            parts.push(part);
        }
        if let Some(activity) = &self.activity {
            parts.push(activity.clone());
        }
        format!(
            "[{}] {}",
            format_clock(self.started.elapsed()),
            parts.join("  |  ")
        )
    }

    fn board_name(&self, mac_address: MacAddress) -> String {
        self.names
            .get(&mac_address)
            .cloned()
            .unwrap_or_else(|| mac_address_human_name(mac_address))
    }

    fn print_sample(&self, output: &BalanceBoardOutput) {
        let value = match output {
            BalanceBoardOutput::Raw(reading) => {
                let cop = reading.calculate_cop();
                json!({
                    "event": "raw",
                    "macAddress": mac_address_human_name(reading.mac_address),
                    "timestampMicros": reading.timestamp.timestamp_micros(),
                    "topLeft": reading.top_left,
                    "topRight": reading.top_right,
                    "bottomLeft": reading.bottom_left,
                    "bottomRight": reading.bottom_right,
                    "weightKg": reading.top_left + reading.top_right + reading.bottom_left + reading.bottom_right,
                    "copX": cop.x,
                    "copY": cop.y,
                })
            }
            BalanceBoardOutput::Processed(data) => json!({
                "event": "processed",
                "macAddress": mac_address_human_name(data.mac_address),
                "timestampMicros": data.timestamp.timestamp_micros(),
                "vCopX": data.sway_metrics.as_ref().map(|m| m.v_cop_x),
                "vCopY": data.sway_metrics.as_ref().map(|m| m.v_cop_y),
                "stabilityIndex": data.stability_index,
                "mlsi": data.dpsi_metrics.as_ref().map(|m| m.mlsi),
                "apsi": data.dpsi_metrics.as_ref().map(|m| m.apsi),
                "vsi": data.dpsi_metrics.as_ref().map(|m| m.vsi),
                "dpsi": data.dpsi_metrics.as_ref().map(|m| m.dpsi),
            }),
        };
        let mut stdout = std::io::stdout().lock();
        // A closed pipe (e.g. `| head`) is not an error worth reporting.
        let _ = writeln!(stdout, "{value}");
    }
}

/// Boards that share a name (fresh boards are all "Nintendo RVL-WBC-01") get the tail of
/// their MAC address appended so the status line can be told apart.
fn disambiguate(names: &mut HashMap<MacAddress, String>) {
    let mut counts: HashMap<&str, usize> = HashMap::new();
    for name in names.values() {
        *counts.entry(name.as_str()).or_default() += 1;
    }
    let duplicated: Vec<MacAddress> = names
        .iter()
        .filter(|(_, name)| counts[name.as_str()] > 1)
        .map(|(&mac_address, _)| mac_address)
        .collect();
    for mac_address in duplicated {
        let suffix = &mac_address_human_name(mac_address)[12..];
        if let Some(name) = names.get_mut(&mac_address) {
            name.push_str(&format!(" {suffix}"));
        }
    }
}

/// A future that resolves after `duration`, or never when `None`.
pub fn deadline(
    duration: Option<Duration>,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()>>> {
    match duration {
        Some(duration) => Box::pin(tokio::time::sleep(duration)),
        None => Box::pin(std::future::pending()),
    }
}
