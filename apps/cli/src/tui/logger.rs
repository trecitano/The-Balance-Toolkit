//! The dashboard's message pane. The core's log records are captured here instead of going
//! to stderr, where they would tear the screen, and the dashboard's own messages ("Tared
//! Left board", errors) land in the same place.

use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

const CAPACITY: usize = 500;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Severity {
    Info,
    Warn,
    Error,
}

#[derive(Clone, Debug)]
pub struct Entry {
    /// Time since the dashboard started.
    pub at: Duration,
    pub severity: Severity,
    pub text: String,
}

#[derive(Clone)]
pub struct LogBuffer {
    started: Instant,
    entries: Arc<Mutex<VecDeque<Entry>>>,
}

impl Default for LogBuffer {
    fn default() -> Self {
        Self {
            started: Instant::now(),
            entries: Arc::default(),
        }
    }
}

impl LogBuffer {
    pub fn push(&self, severity: Severity, text: impl Into<String>) {
        let mut entries = self.entries.lock().unwrap_or_else(|e| e.into_inner());
        if entries.len() == CAPACITY {
            entries.pop_front();
        }
        entries.push_back(Entry {
            at: self.started.elapsed(),
            severity,
            text: text.into(),
        });
    }

    pub fn info(&self, text: impl Into<String>) {
        self.push(Severity::Info, text);
    }

    pub fn warn(&self, text: impl Into<String>) {
        self.push(Severity::Warn, text);
    }

    pub fn error(&self, text: impl Into<String>) {
        self.push(Severity::Error, text);
    }

    /// The most recent `count` entries, oldest first.
    pub fn tail(&self, count: usize) -> Vec<Entry> {
        let entries = self.entries.lock().unwrap_or_else(|e| e.into_inner());
        let skip = entries.len().saturating_sub(count);
        entries.iter().skip(skip).cloned().collect()
    }
}

struct TuiLogger {
    buffer: LogBuffer,
}

impl log::Log for TuiLogger {
    fn enabled(&self, metadata: &log::Metadata) -> bool {
        metadata.level() <= log::max_level()
    }

    fn log(&self, record: &log::Record) {
        if !self.enabled(record.metadata()) {
            return;
        }
        let severity = match record.level() {
            log::Level::Error => Severity::Error,
            log::Level::Warn => Severity::Warn,
            _ => Severity::Info,
        };
        self.buffer
            .push(severity, format!("{}: {}", record.target(), record.args()));
    }

    fn flush(&self) {}
}

/// Routes the `log` crate into a buffer the dashboard draws. Call it instead of
/// `toolkit_core::init_logging`; only one logger can be installed per process.
pub fn install(level: log::LevelFilter) -> LogBuffer {
    let buffer = LogBuffer::default();
    // The logger lives for the rest of the process; `log` wants a `'static` reference.
    let logger: &'static TuiLogger = Box::leak(Box::new(TuiLogger {
        buffer: buffer.clone(),
    }));
    if log::set_logger(logger).is_ok() {
        log::set_max_level(level);
    }
    buffer
}
