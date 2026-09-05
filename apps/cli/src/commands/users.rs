use anyhow::Result;
use clap::Subcommand;
use toolkit_core::ToolkitCommand;
use toolkit_core::types::UserPageInformation;

use crate::client::Toolkit;
use crate::output::{Table, or_dash, print_json, yes_no};

#[derive(Subcommand)]
pub enum UsersCommand {
    /// List users. Create and edit them in the desktop app.
    List,
}

pub async fn run(toolkit: &mut Toolkit, command: UsersCommand, json: bool) -> Result<()> {
    match command {
        UsersCommand::List => list(toolkit, json).await,
    }
}

async fn list(toolkit: &Toolkit, json: bool) -> Result<()> {
    let page: UserPageInformation = toolkit
        .request(|response| ToolkitCommand::UserPageInformation { response })
        .await?;
    if json {
        return print_json(&page.users);
    }
    let mut table = Table::new(&["ID", "NAME", "AGE", "HEIGHT", "WEIGHT", "DEFAULT"]);
    for user in &page.users {
        table.row(vec![
            user.id.to_string(),
            user.name.clone(),
            or_dash(&user.age),
            measure(user.height, user.height_metric.as_deref()),
            measure(user.weight.map(f64::from), user.weight_metric.as_deref()),
            yes_no(user.is_default).to_string(),
        ]);
    }
    table.print();
    Ok(())
}

fn measure(value: Option<f64>, unit: Option<&str>) -> String {
    match value {
        Some(value) => format!("{value} {}", unit.unwrap_or_default())
            .trim_end()
            .to_string(),
        None => "-".to_string(),
    }
}
