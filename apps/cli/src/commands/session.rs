use anyhow::{Context, Result, bail};
use clap::{Args, Subcommand, ValueEnum};
use std::collections::{BTreeSet, HashMap};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use tokio::sync::mpsc;
use toolkit_core::actors::balance_board_actor::BalanceBoardOutput;
use toolkit_core::actors::state::activities::Activity;
use toolkit_core::file_system::ExistingSessionFileSystem;
use toolkit_core::processing::data_processor::InterpolationSetting;
use toolkit_core::processing::file_writer::SessionConfigurationFileFormat;
use toolkit_core::types::{
    GeneralSettings, MacAddress, NintendoDevice, SessionInformation, SessionSettings,
};
use toolkit_core::utils::mac_address_human_name;
use toolkit_core::{ToolkitCommand, ToolkitResponse};

use crate::client::{Toolkit, find_activity, resolve_board, resolve_user};
use crate::live::{LiveMode, LiveMonitor, deadline};
use crate::output::{format_duration, print_json, yes_no};

#[derive(Subcommand)]
pub enum SessionCommand {
    /// Record a session until Ctrl-C, until the activity ends, or until --duration elapses.
    Run(RunArgs),
    /// Show the configuration the next recording would use.
    Show,
    /// Show the most recent recording in the default session directory.
    Last,
}

#[derive(Args)]
pub struct RunArgs {
    /// Boards to record from, by name or MAC address. Defaults to every connected board.
    #[arg(value_name = "BOARD")]
    pub boards: Vec<String>,

    /// User the session is recorded for, by id or name. Defaults to the default user.
    #[arg(long, value_name = "ID|NAME")]
    pub user: Option<String>,

    /// Activity template to run; the session stops when it finishes (`tbt activities list`).
    #[arg(long, value_name = "ID")]
    pub activity: Option<String>,

    /// Stop after this many seconds.
    #[arg(long, value_name = "SECONDS", conflicts_with = "activity")]
    pub duration: Option<u64>,

    /// Zero the boards right before recording starts.
    #[arg(long)]
    pub tare: bool,

    /// Seconds to wait for the boards to come online.
    #[arg(long, value_name = "SECONDS", default_value_t = 10)]
    pub connect_timeout: u64,

    #[command(flatten)]
    pub streams: StreamArgs,

    #[command(flatten)]
    pub processing: ProcessingArgs,
}

/// Options shared by `session run` and `replay run`.
#[derive(Args)]
pub struct StreamArgs {
    /// Stream raw and processed data over TCP. Addresses come from the settings.
    #[arg(long)]
    pub tcp: bool,

    /// Stream raw and processed data over Lab Streaming Layer. Names come from the settings.
    #[arg(long)]
    pub lsl: bool,

    /// Directory for the CSV and settings files. Defaults to the session directory in the
    /// settings.
    #[arg(long, value_name = "DIR")]
    pub output: Option<PathBuf>,

    /// What to print while running. `samples` writes JSON Lines to stdout for piping.
    #[arg(long, value_enum, default_value_t = LiveMode::Status)]
    pub live: LiveMode,
}

impl StreamArgs {
    pub fn apply(&self, core: &mut SessionSettings, default_output: &Path) {
        core.tcp_enabled = self.tcp;
        core.lsl_enabled = self.lsl;
        if let Some(output) = &self.output {
            core.output_directory = output.clone();
        } else if core.output_directory.as_os_str().is_empty() {
            core.output_directory = default_output.to_path_buf();
        }
    }
}

#[derive(Args)]
pub struct ProcessingArgs {
    /// Analysis window length in milliseconds.
    #[arg(long, value_name = "MS")]
    pub window_size_ms: Option<u64>,

    /// How far the analysis window advances between results, in milliseconds.
    #[arg(long, value_name = "MS")]
    pub window_slide_ms: Option<u64>,

    /// Resampling rate of the processed stream in hertz.
    #[arg(long, value_name = "HZ")]
    pub sampling_rate: Option<u64>,

    /// Interpolation used when resampling.
    #[arg(long, value_enum)]
    pub interpolation: Option<Interpolation>,
}

impl ProcessingArgs {
    pub fn apply(&self, core: &mut SessionSettings) {
        if let Some(value) = self.window_size_ms {
            core.window_size_ms = value;
        }
        if let Some(value) = self.window_slide_ms {
            core.window_slide_ms = value;
        }
        if let Some(value) = self.sampling_rate {
            core.sampling_rate = value;
        }
        if let Some(value) = self.interpolation {
            core.interpolation = value.into();
        }
    }
}

#[derive(Copy, Clone, Debug, ValueEnum)]
pub enum Interpolation {
    Linear,
    Cubic,
    Polynomial,
}

impl From<Interpolation> for InterpolationSetting {
    fn from(value: Interpolation) -> Self {
        match value {
            Interpolation::Linear => InterpolationSetting::Linear,
            Interpolation::Cubic => InterpolationSetting::Cubic,
            Interpolation::Polynomial => InterpolationSetting::Polynomial,
        }
    }
}

pub async fn run(toolkit: &mut Toolkit, command: SessionCommand, json: bool) -> Result<()> {
    match command {
        SessionCommand::Run(args) => record(toolkit, args).await,
        SessionCommand::Show => show(toolkit, json).await,
        SessionCommand::Last => last(toolkit, json).await,
    }
}

async fn record(toolkit: &mut Toolkit, args: RunArgs) -> Result<()> {
    let boards = toolkit.boards().await?;
    let targets: Vec<NintendoDevice> = if args.boards.is_empty() {
        boards.iter().filter(|b| b.is_connected).cloned().collect()
    } else {
        args.boards
            .iter()
            .map(|reference| resolve_board(&boards, reference).cloned())
            .collect::<Result<_>>()?
    };
    if targets.is_empty() {
        bail!(
            "No board is connected. Pair one with `tbt devices scan`, or name a paired board \
             (`tbt devices list`) after powering it on."
        );
    }
    for board in &targets {
        if !board.is_connected {
            bail!(
                "{} ({}) is not connected. Power it on; a paired board reconnects by itself.",
                board.name,
                mac_address_human_name(board.mac_address)
            );
        }
    }
    let mac_addresses: Vec<MacAddress> = targets.iter().map(|b| b.mac_address).collect();
    eprintln!("Connecting to {} board(s)...", mac_addresses.len());
    toolkit
        .select_boards_for_session(&mac_addresses, Duration::from_secs(args.connect_timeout))
        .await?;

    let settings = toolkit.settings().await?;
    let info = session_information(toolkit).await?;
    let mut core = info.core.clone();
    if let Some(user) = &args.user {
        core.selected_user = resolve_user(&info.available_users, user)?;
    }
    if let Some(activity_id) = &args.activity {
        find_activity(&toolkit.activities().await?, activity_id)?;
        core.activity_id = Some(activity_id.clone());
    }
    args.streams
        .apply(&mut core, &settings.store_files_default_directory);
    args.processing.apply(&mut core);
    prepare_output_directory(&settings, &core.output_directory)?;
    toolkit
        .request(|response| ToolkitCommand::UpdateSessionInformation {
            configuration: core,
            response,
        })
        .await?;
    let info = session_information(toolkit).await?;

    let names: HashMap<MacAddress, String> = targets
        .iter()
        .map(|b| (b.mac_address, b.name.clone()))
        .collect();
    let user = info
        .available_users
        .iter()
        .find(|u| u.id == info.core.selected_user)
        .map(|u| u.name.clone())
        .unwrap_or_else(|| format!("#{}", info.core.selected_user));
    Plan {
        boards: &names,
        user: &user,
        activity: info.activity.as_ref(),
        duration: args.duration.map(Duration::from_secs),
        core: &info.core,
        settings: &settings,
    }
    .print();

    if args.tare {
        eprintln!("Taring boards...");
        toolkit
            .request(|response| ToolkitCommand::SessionTareDevices { response })
            .await?;
    }

    let recording = RecordingWatch::before(
        &settings,
        &info.core.output_directory,
        names.keys().copied(),
    );
    let (data_tx, data_rx) = mpsc::channel(2048);
    toolkit
        .request(|response| ToolkitCommand::StartSession {
            frontend_channel: data_tx,
            response,
        })
        .await?;
    eprintln!("Recording. Press Ctrl-C to stop.");

    let monitor = LiveMonitor::new(args.streams.live, names);
    let outcome = run_until_done(
        toolkit,
        data_rx,
        monitor,
        args.duration.map(Duration::from_secs),
        info.activity.is_some(),
        Kind::Session,
    )
    .await?;
    if outcome.needs_stop {
        toolkit
            .request(|response| ToolkitCommand::StopSession { response })
            .await?;
    }
    eprintln!(
        "Session finished after {} with {} raw samples.",
        format_duration(outcome.elapsed),
        outcome.raw_samples
    );
    recording.wait_and_report().await?;
    Ok(())
}

async fn session_information(toolkit: &Toolkit) -> Result<SessionInformation> {
    toolkit
        .request(|response| ToolkitCommand::SessionInformation { response })
        .await
}

pub fn prepare_output_directory(settings: &GeneralSettings, directory: &Path) -> Result<()> {
    if settings.store_raw_session || settings.store_processed_data {
        std::fs::create_dir_all(directory)
            .with_context(|| format!("Cannot create output directory {}", directory.display()))?;
    }
    Ok(())
}

async fn show(toolkit: &Toolkit, json: bool) -> Result<()> {
    let info = session_information(toolkit).await?;
    if json {
        return print_json(&info);
    }
    let settings = toolkit.settings().await?;
    let user = info
        .available_users
        .iter()
        .find(|u| u.id == info.core.selected_user)
        .map(|u| u.name.clone())
        .unwrap_or_else(|| format!("#{}", info.core.selected_user));
    let boards: HashMap<MacAddress, String> = info
        .selected_boards
        .iter()
        .map(|b| (b.mac_address, b.name.clone()))
        .collect();
    Plan {
        boards: &boards,
        user: &user,
        activity: info.activity.as_ref(),
        duration: None,
        core: &info.core,
        settings: &settings,
    }
    .print_to_stdout();
    println!();
    println!(
        "Boards are chosen per run: `tbt session run [BOARD]...` defaults to every connected board."
    );
    Ok(())
}

async fn last(toolkit: &Toolkit, json: bool) -> Result<()> {
    let last = toolkit
        .request(|response| ToolkitCommand::LastSessionInformation { response })
        .await?;
    let Some(last) = last else {
        let settings = toolkit.settings().await?;
        println!(
            "No recordings found in {}.",
            settings.store_files_default_directory.display()
        );
        return Ok(());
    };
    if json {
        return print_json(&last);
    }
    println!("File:      {}", last.file_location);
    println!("User:      {}", last.user.name);
    println!(
        "Activity:  {}",
        last.activity
            .as_ref()
            .map(|a| a.title.clone())
            .unwrap_or_else(|| "none".to_string())
    );
    println!(
        "Duration:  {}",
        format_duration(last.session_stats.duration)
    );
    println!(
        "Rate:      {:.1} Hz",
        last.session_stats.board_sampling_rate
    );
    Ok(())
}

/// Human summary of what a run is about to do, printed before recording starts.
pub struct Plan<'a> {
    pub boards: &'a HashMap<MacAddress, String>,
    pub user: &'a str,
    pub activity: Option<&'a Activity>,
    pub duration: Option<Duration>,
    pub core: &'a SessionSettings,
    pub settings: &'a GeneralSettings,
}

impl Plan<'_> {
    pub fn print(&self) {
        for line in self.lines() {
            eprintln!("{line}");
        }
    }

    fn print_to_stdout(&self) {
        for line in self.lines() {
            println!("{line}");
        }
    }

    fn lines(&self) -> Vec<String> {
        let mut boards: Vec<String> = self
            .boards
            .iter()
            .map(|(mac, name)| format!("{name} ({})", mac_address_human_name(*mac)))
            .collect();
        boards.sort();
        let mut lines = vec![format!(
            "Boards:    {}",
            if boards.is_empty() {
                "none".to_string()
            } else {
                boards.join(", ")
            }
        )];
        lines.push(format!("User:      {}", self.user));
        lines.push(format!(
            "Activity:  {}",
            match self.activity {
                Some(activity) => format!(
                    "{} ({})",
                    activity.title,
                    format_duration(Duration::from_millis(
                        activity.get_total_duration_ms().max(0) as u64
                    ))
                ),
                None => match self.duration {
                    Some(duration) => format!("none, stopping after {}", format_duration(duration)),
                    None => "none, stopping on Ctrl-C".to_string(),
                },
            }
        ));
        let store = self.settings.store_raw_session || self.settings.store_processed_data;
        lines.push(format!(
            "Output:    {}",
            if store {
                format!(
                    "{} (raw: {}, processed: {})",
                    self.core.output_directory.display(),
                    yes_no(self.settings.store_raw_session),
                    yes_no(self.settings.store_processed_data)
                )
            } else {
                "disabled in settings".to_string()
            }
        ));
        lines.push(format!(
            "TCP:       {}",
            if self.core.tcp_enabled {
                format!(
                    "on (raw {}, processed {})",
                    self.settings.tcp_connection_string_raw,
                    self.settings.tcp_connection_string_processed
                )
            } else {
                "off".to_string()
            }
        ));
        lines.push(format!(
            "LSL:       {}",
            if self.core.lsl_enabled {
                format!("on (stream '{}')", self.settings.lsl_stream_name)
            } else {
                "off".to_string()
            }
        ));
        lines.push(format!(
            "Analysis:  {} ms window, {} ms slide, {} Hz, {:?} interpolation",
            self.core.window_size_ms,
            self.core.window_slide_ms,
            self.core.sampling_rate,
            self.core.interpolation
        ));
        lines
    }
}

#[derive(Copy, Clone, PartialEq, Eq)]
pub enum Kind {
    Session,
    Replay,
}

pub struct Outcome {
    /// True when the run was interrupted here and the manager still has to be told to stop.
    pub needs_stop: bool,
    pub elapsed: Duration,
    pub raw_samples: u64,
}

/// Drives a started session or replay: feeds the live monitor, polls the activity state,
/// and returns on Ctrl-C, on the deadline, or when the manager reports completion.
pub async fn run_until_done(
    toolkit: &mut Toolkit,
    mut data_rx: mpsc::Receiver<BalanceBoardOutput>,
    mut monitor: LiveMonitor,
    duration: Option<Duration>,
    has_activity: bool,
    kind: Kind,
) -> Result<Outcome> {
    let started = Instant::now();
    let ctrl_c = tokio::signal::ctrl_c();
    tokio::pin!(ctrl_c);
    let deadline = deadline(duration);
    tokio::pin!(deadline);
    let mut ticker = tokio::time::interval(Duration::from_millis(250));
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    let mut data_open = true;

    let needs_stop = loop {
        tokio::select! {
            _ = &mut ctrl_c => {
                monitor.finish();
                eprintln!("Stopping...");
                // A second Ctrl-C while shutting down ends the process outright.
                tokio::spawn(async {
                    let _ = tokio::signal::ctrl_c().await;
                    std::process::exit(130);
                });
                break true;
            }
            _ = &mut deadline => {
                monitor.finish();
                break true;
            }
            sample = data_rx.recv(), if data_open => {
                match sample {
                    Some(sample) => monitor.record(&sample),
                    None => data_open = false,
                }
            }
            event = toolkit.events.recv() => {
                match (event, kind) {
                    (Some(ToolkitResponse::SessionCompleted), Kind::Session)
                    | (Some(ToolkitResponse::ReplayCompleted), Kind::Replay) => {
                        monitor.finish();
                        break false;
                    }
                    (None, _) => bail!("The toolkit manager stopped unexpectedly"),
                    _ => {}
                }
            }
            _ = ticker.tick() => {
                if has_activity && kind == Kind::Session {
                    let state = toolkit_core::request(&toolkit.commands, |response| {
                        ToolkitCommand::SessionActivityState { response }
                    })
                    .await?;
                    monitor.set_activity(state.as_ref());
                }
                monitor.tick();
            }
        }
    };

    Ok(Outcome {
        needs_stop,
        elapsed: started.elapsed(),
        raw_samples: monitor.total_raw_samples(),
    })
}

/// Watches the output directory so the process only exits once the file writer has
/// finalised the recording (the settings file is rewritten with the session statistics).
pub struct RecordingWatch {
    enabled: bool,
    directory: PathBuf,
    previous: Option<String>,
    boards: BTreeSet<MacAddress>,
}

impl RecordingWatch {
    pub fn before(
        settings: &GeneralSettings,
        directory: &Path,
        boards: impl IntoIterator<Item = MacAddress>,
    ) -> Self {
        let enabled = settings.store_raw_session || settings.store_processed_data;
        let previous = if enabled {
            ExistingSessionFileSystem::load_latest_session_file(directory).map(|(path, _)| path)
        } else {
            None
        };
        Self {
            enabled,
            directory: directory.to_path_buf(),
            previous,
            boards: boards.into_iter().collect(),
        }
    }

    /// How long a finished run may take to finalise its files before it is reported as a
    /// failure.
    pub const TIMEOUT: Duration = Duration::from_secs(10);

    pub fn enabled(&self) -> bool {
        self.enabled
    }

    pub fn directory(&self) -> &Path {
        &self.directory
    }

    /// The finalised recording of this run, once the file writer has rewritten its settings
    /// file with the session statistics.
    pub fn finalised(&self) -> Option<(String, SessionConfigurationFileFormat)> {
        let (path, session) = ExistingSessionFileSystem::load_latest_session_file(&self.directory)?;
        let boards: BTreeSet<MacAddress> = session.device_names.keys().copied().collect();
        let done = self.previous.as_deref() != Some(path.as_str())
            && boards == self.boards
            && session.session_stats.duration > Duration::ZERO;
        done.then_some((path, session))
    }

    /// `Saved <path>` followed by one line per board with its raw and processed file names.
    pub fn describe(path: &str, session: &SessionConfigurationFileFormat) -> Vec<String> {
        let mut lines = vec![format!("Saved {path}")];
        let mut names: Vec<(&MacAddress, &String)> = session.device_names.iter().collect();
        names.sort_by(|a, b| a.1.cmp(b.1));
        for (mac_address, name) in names {
            if let Some(files) = session.device_file_mappings.get(mac_address) {
                lines.push(format!(
                    "  {name}: {} / {}",
                    files.raw_file_name, files.processed_file_name
                ));
            }
        }
        lines
    }

    pub async fn wait_and_report(&self) -> Result<()> {
        if !self.enabled {
            eprintln!("Recording to disk is disabled in the settings; no files were written.");
            return Ok(());
        }
        let started = Instant::now();
        loop {
            if let Some((path, session)) = self.finalised() {
                for line in Self::describe(&path, &session) {
                    eprintln!("{line}");
                }
                return Ok(());
            }
            if started.elapsed() > Self::TIMEOUT {
                bail!(
                    "The recording in {} was not finalised within {}s; its files may be incomplete.",
                    self.directory.display(),
                    Self::TIMEOUT.as_secs()
                );
            }
            tokio::time::sleep(Duration::from_millis(200)).await;
        }
    }
}
