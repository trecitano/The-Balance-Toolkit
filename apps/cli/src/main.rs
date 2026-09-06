//! `tbt`: the headless frontend for The Balance Toolkit.
//!
//! Every subcommand starts the same `ConnectionManager` the desktop app runs, drives it over
//! `ToolkitCommand`s, and exits. Without a subcommand (or with `tui`) it opens an interactive
//! dashboard over the same manager instead. Board pairings live in the operating system, and settings,
//! users and activities live in the application directory, so state carries across
//! invocations and is shared with the desktop app.

mod client;
mod commands;
mod live;
mod output;
mod tui;

use anyhow::{Result, bail};
use clap::{CommandFactory, Parser, Subcommand};
use client::Toolkit;
use commands::{activities, devices, replay, session, settings, users};
use std::io::IsTerminal;

#[derive(Parser)]
#[command(
    name = "tbt",
    version,
    about = "Headless frontend for The Balance Toolkit",
    long_about = "Pair Wii Balance Boards, record and replay sessions, and stream live data over TCP \
                  and LSL from a terminal. State (settings, users, activities, recordings) is shared \
                  with the desktop app. Without a command, `tbt` opens an interactive dashboard.",
    propagate_version = true
)]
struct Cli {
    /// Print machine-readable JSON instead of tables where a command lists or shows data.
    #[arg(long, global = true, help_heading = "Global options")]
    json: bool,

    /// Log verbosity for the toolkit core: error, warn, info, debug or trace.
    /// Overrides the TBT_LOG environment variable. Logs go to stderr.
    #[arg(
        long,
        global = true,
        value_name = "LEVEL",
        value_parser = parse_log_level,
        help_heading = "Global options"
    )]
    log_level: Option<log::LevelFilter>,

    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    /// Open the interactive dashboard: boards, recording, replay and settings in one screen.
    /// This is the default when no command is given.
    Tui,
    /// Pair, list and manage Wii Balance Boards.
    #[command(subcommand)]
    Devices(devices::DevicesCommand),
    /// Record a live session from one or more boards.
    #[command(subcommand)]
    Session(session::SessionCommand),
    /// Replay a recorded session through the processing pipeline and streams.
    #[command(subcommand)]
    Replay(replay::ReplayCommand),
    /// Show and change the toolkit settings shared with the desktop app.
    #[command(subcommand)]
    Settings(settings::SettingsCommand),
    /// List the users a session can be recorded for.
    #[command(subcommand)]
    Users(users::UsersCommand),
    /// List the posturography activity templates.
    #[command(subcommand)]
    Activities(activities::ActivitiesCommand),
}

fn parse_log_level(text: &str) -> Result<log::LevelFilter, String> {
    text.parse()
        .map_err(|_| format!("'{text}' is not one of error, warn, info, debug, trace"))
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    let result = if matches!(cli.command, None | Some(Command::Tui)) {
        dashboard(&cli).await
    } else {
        // Quieter than the desktop app by default: the terminal is the user interface here,
        // and `info` traces from the core would drown the command output.
        toolkit_core::init_logging(log::LevelFilter::Warn);
        if let Some(level) = cli.log_level {
            log::set_max_level(level);
        }
        run(cli).await
    };

    let code = match result {
        Ok(()) => 0,
        Err(error) => {
            eprintln!("error: {error:#}");
            1
        }
    };
    // Board readers and stream writers run on their own threads; do not wait for them.
    std::process::exit(code);
}

/// The interactive dashboard. Log records are shown in its message pane rather than on
/// stderr, where they would tear the screen; `--log-level` and `TBT_LOG` still pick the level.
async fn dashboard(cli: &Cli) -> Result<()> {
    if !std::io::stdout().is_terminal() {
        bail!("The dashboard needs a terminal. Run `tbt --help` for the scriptable commands.");
    }
    let level = cli
        .log_level
        .or_else(|| std::env::var("TBT_LOG").ok()?.parse().ok())
        .unwrap_or(log::LevelFilter::Warn);
    let log = tui::logger::install(level);
    let toolkit = Toolkit::start()?;
    tui::run(toolkit, log).await
}

async fn run(cli: Cli) -> Result<()> {
    let mut toolkit = Toolkit::start()?;
    let json = cli.json;

    match cli.command.unwrap_or(Command::Tui) {
        Command::Tui => Cli::command().print_help().map_err(Into::into),
        Command::Devices(command) => devices::run(&mut toolkit, command, json).await,
        Command::Session(command) => session::run(&mut toolkit, command, json).await,
        Command::Replay(command) => replay::run(&mut toolkit, command).await,
        Command::Settings(command) => settings::run(&mut toolkit, command, json).await,
        Command::Users(command) => users::run(&mut toolkit, command, json).await,
        Command::Activities(command) => activities::run(&mut toolkit, command, json).await,
    }
}
