use anyhow::{Context, Result};
use clap::{Args, Subcommand};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::sync::mpsc;
use toolkit_core::ToolkitCommand;
use toolkit_core::file_system::ExistingSessionFileSystem;
use toolkit_core::types::{MacAddress, ReplayInformation};

use crate::client::Toolkit;
use crate::commands::session::{
    Kind, Plan, ProcessingArgs, RecordingWatch, StreamArgs, prepare_output_directory,
    run_until_done,
};
use crate::live::LiveMonitor;
use crate::output::format_duration;

#[derive(Subcommand)]
pub enum ReplayCommand {
    /// Play a recorded session back through the processing pipeline and the streams.
    Run(ReplayArgs),
}

#[derive(Args)]
pub struct ReplayArgs {
    /// The session's `tbt-….settings.json` file. Its raw CSV files must sit next to it.
    #[arg(value_name = "SETTINGS_FILE")]
    pub file: PathBuf,

    #[command(flatten)]
    pub streams: StreamArgs,

    #[command(flatten)]
    pub processing: ProcessingArgs,
}

pub async fn run(toolkit: &mut Toolkit, command: ReplayCommand) -> Result<()> {
    match command {
        ReplayCommand::Run(args) => replay(toolkit, args).await,
    }
}

async fn replay(toolkit: &mut Toolkit, args: ReplayArgs) -> Result<()> {
    let file = args
        .file
        .canonicalize()
        .with_context(|| format!("Cannot open {}", args.file.display()))?;
    let recorded = ExistingSessionFileSystem::load(&file)
        .with_context(|| format!("{} is not a session settings file", file.display()))?;

    toolkit
        .request(|response| ToolkitCommand::LoadReplayFile {
            file_path: file.clone(),
            response,
        })
        .await
        .context("Failed to load the session for replay (details in the log above)")?;

    let settings = toolkit.settings().await?;
    let info = replay_information(toolkit).await?;
    let mut core = info.core.clone();
    args.streams
        .apply(&mut core, &settings.store_files_default_directory);
    args.processing.apply(&mut core);
    prepare_output_directory(&settings, &core.output_directory)?;
    toolkit
        .request(|response| ToolkitCommand::UpdateReplayInformation {
            configuration: core,
            response,
        })
        .await?;
    let info = replay_information(toolkit).await?;

    let names: HashMap<MacAddress, String> = info
        .devices
        .iter()
        .map(|b| (b.mac_address, b.name.clone()))
        .collect();
    eprintln!("Replaying {}", file.display());
    Plan {
        boards: &names,
        user: &info.user.name,
        activity: info.activity.as_ref(),
        duration: Some(recorded.session_stats.duration),
        core: &info.core,
        settings: &settings,
    }
    .print();

    let recording = RecordingWatch::before(
        &settings,
        &info.core.output_directory,
        names.keys().copied(),
    );
    let (data_tx, data_rx) = mpsc::channel(2048);
    toolkit
        .request(|response| ToolkitCommand::StartReplay {
            frontend_channel: data_tx,
            response,
        })
        .await?;
    eprintln!(
        "Replaying {} of data. Press Ctrl-C to stop.",
        format_duration(recorded.session_stats.duration)
    );

    let monitor = LiveMonitor::new(args.streams.live, names);
    let outcome = run_until_done(toolkit, data_rx, monitor, None, false, Kind::Replay).await?;
    if outcome.needs_stop {
        toolkit
            .request(|response| ToolkitCommand::StopReplay { response })
            .await?;
    }
    eprintln!(
        "Replay finished after {} with {} raw samples.",
        format_duration(outcome.elapsed),
        outcome.raw_samples
    );
    recording.wait_and_report().await?;
    Ok(())
}

async fn replay_information(toolkit: &Toolkit) -> Result<ReplayInformation> {
    toolkit
        .request(|response| ToolkitCommand::ReplayInformation { response })
        .await?
        .context("The session file did not load")
}
