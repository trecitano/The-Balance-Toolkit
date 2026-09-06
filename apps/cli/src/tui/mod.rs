//! `tbt tui`: an interactive dashboard over the same manager the subcommands drive. Pair
//! and manage boards, configure and watch a recording, replay a file and edit the settings
//! without leaving the terminal.

pub mod app;
pub mod logger;
mod ui;

use anyhow::Result;
use ratatui::crossterm::event::{self, Event, KeyEventKind};
use std::time::Duration;
use tokio::sync::mpsc;

use crate::client::Toolkit;
use app::App;
use logger::LogBuffer;

/// Takes over the terminal until the user quits. The terminal is restored on the way out,
/// on errors and on panics alike.
pub async fn run(toolkit: Toolkit, log: LogBuffer) -> Result<()> {
    let mut app = App::new(toolkit, log).await?;
    let mut terminal = ratatui::init();
    let result = event_loop(&mut terminal, &mut app).await;
    ratatui::restore();
    result
}

async fn event_loop(terminal: &mut ratatui::DefaultTerminal, app: &mut App) -> Result<()> {
    let mut input = spawn_input_reader();
    let mut ticker = tokio::time::interval(Duration::from_millis(100));
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    while !app.should_quit {
        terminal.draw(|frame| ui::draw(frame, app))?;
        let outcome = tokio::select! {
            event = input.recv() => match event {
                Some(Event::Key(key)) if key.kind == KeyEventKind::Press => app.handle_key(key).await,
                Some(_) => Ok(()),
                None => break,
            },
            sample = App::next_sample(&mut app.phase) => {
                app.record(sample);
                Ok(())
            }
            event = app.toolkit.events.recv() => match event {
                Some(event) => app.handle_event(event).await,
                None => anyhow::bail!("The toolkit manager stopped unexpectedly"),
            },
            _ = ticker.tick() => app.tick().await,
        };
        // A failed action is reported in the message pane; only a dead manager ends the loop.
        if let Err(error) = outcome {
            app.log.error(format!("{error:#}"));
        }
    }
    Ok(())
}

/// Terminal input arrives on a blocking reader thread; the thread ends with the process.
fn spawn_input_reader() -> mpsc::UnboundedReceiver<Event> {
    let (tx, rx) = mpsc::unbounded_channel();
    std::thread::spawn(move || {
        while let Ok(event) = event::read() {
            if tx.send(event).is_err() {
                break;
            }
        }
    });
    rx
}
