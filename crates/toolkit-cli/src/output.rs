//! Terminal output helpers: aligned tables, JSON, and small formatters.

use anyhow::Result;
use serde::Serialize;
use std::fmt::Display;
use std::time::Duration;

/// Left-aligned columns separated by two spaces, sized to the widest cell.
pub struct Table {
    headers: Vec<String>,
    rows: Vec<Vec<String>>,
}

impl Table {
    pub fn new(headers: &[&str]) -> Self {
        Self {
            headers: headers.iter().map(|h| h.to_string()).collect(),
            rows: Vec::new(),
        }
    }

    pub fn row(&mut self, cells: Vec<String>) {
        self.rows.push(cells);
    }

    pub fn print(&self) {
        let columns = self.headers.len();
        let mut widths: Vec<usize> = self.headers.iter().map(|h| h.chars().count()).collect();
        for row in &self.rows {
            for (i, cell) in row.iter().enumerate().take(columns) {
                widths[i] = widths[i].max(cell.chars().count());
            }
        }
        let render = |cells: &[String]| {
            cells
                .iter()
                .enumerate()
                .take(columns)
                .map(|(i, cell)| {
                    if i + 1 == columns {
                        cell.clone()
                    } else {
                        format!("{cell:<width$}", width = widths[i])
                    }
                })
                .collect::<Vec<_>>()
                .join("  ")
                .trim_end()
                .to_string()
        };
        println!("{}", render(&self.headers));
        for row in &self.rows {
            println!("{}", render(row));
        }
    }
}

pub fn print_json<T: Serialize>(value: &T) -> Result<()> {
    println!("{}", serde_json::to_string_pretty(value)?);
    Ok(())
}

pub fn or_dash<T: Display>(value: &Option<T>) -> String {
    value
        .as_ref()
        .map(|v| v.to_string())
        .unwrap_or_else(|| "-".to_string())
}

pub fn yes_no(value: bool) -> &'static str {
    if value { "yes" } else { "no" }
}

/// `1m 05s`, `12s`, `0.5s`.
pub fn format_duration(duration: Duration) -> String {
    let total = duration.as_secs_f64();
    if total < 10.0 {
        return format!("{total:.1}s");
    }
    let secs = duration.as_secs();
    let (h, m, s) = (secs / 3600, (secs % 3600) / 60, secs % 60);
    if h > 0 {
        format!("{h}h {m:02}m {s:02}s")
    } else if m > 0 {
        format!("{m}m {s:02}s")
    } else {
        format!("{s}s")
    }
}

/// `mm:ss` for the elapsed counter in live status lines.
pub fn format_clock(duration: Duration) -> String {
    let secs = duration.as_secs();
    format!("{:02}:{:02}", secs / 60, secs % 60)
}
