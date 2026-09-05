use anyhow::Result;
use clap::Subcommand;
use std::time::Duration;

use crate::client::{Toolkit, find_activity};
use crate::output::{Table, format_duration, print_json};

#[derive(Subcommand)]
pub enum ActivitiesCommand {
    /// List the activity templates a session can follow.
    List,
    /// Show an activity's timeline.
    Show {
        /// Activity id (see `list`).
        id: String,
    },
}

pub async fn run(toolkit: &mut Toolkit, command: ActivitiesCommand, json: bool) -> Result<()> {
    match command {
        ActivitiesCommand::List => list(toolkit, json).await,
        ActivitiesCommand::Show { id } => show(toolkit, &id, json).await,
    }
}

async fn list(toolkit: &Toolkit, json: bool) -> Result<()> {
    let activities = toolkit.activities().await?;
    if json {
        return print_json(&activities);
    }
    let mut table = Table::new(&["ID", "TITLE", "BOARDS", "LOOPS", "DURATION"]);
    for activity in &activities {
        table.row(vec![
            activity.id.clone(),
            activity.title.clone(),
            activity.boards_required.to_string(),
            activity.loops.to_string(),
            format_duration(Duration::from_millis(
                activity.get_total_duration_ms().max(0) as u64,
            )),
        ]);
    }
    table.print();
    Ok(())
}

async fn show(toolkit: &Toolkit, id: &str, json: bool) -> Result<()> {
    let activities = toolkit.activities().await?;
    let activity = find_activity(&activities, id)?;
    if json {
        return print_json(activity);
    }
    println!("{} ({})", activity.title, activity.id);
    if !activity.description.is_empty() {
        println!("{}", activity.description);
    }
    println!(
        "Boards: {}   Loops: {}   Total: {}",
        activity.boards_required,
        activity.loops,
        format_duration(Duration::from_millis(
            activity.get_total_duration_ms().max(0) as u64
        ))
    );
    println!();
    let mut table = Table::new(&["#", "BLOCK", "ID", "SECONDS"]);
    for (index, block) in activity.timeline_blocks.iter().enumerate() {
        table.row(vec![
            (index + 1).to_string(),
            block.title.clone(),
            block.id.clone(),
            block.duration.to_string(),
        ]);
    }
    table.print();
    Ok(())
}
