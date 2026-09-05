use anyhow::{Context, Result, bail};
use clap::Subcommand;
use serde_json::Value;
use toolkit_core::ToolkitCommand;
use toolkit_core::file_system;
use toolkit_core::types::GeneralSettings;

use crate::client::Toolkit;
use crate::output::{Table, print_json};

#[derive(Subcommand)]
pub enum SettingsCommand {
    /// Print every setting.
    Show,
    /// Change one setting.
    ///
    /// KEY is a name from `show`, nested with dots (for example
    /// `processingSettings.windowSizeMs`). VALUE is read as JSON (`true`, `100`,
    /// `"text"`) and falls back to plain text. Changing `isDemoMode` switches between the
    /// real Bluetooth stack and simulated boards, for the desktop app as well.
    Set { key: String, value: String },
    /// Print where the toolkit keeps its data.
    Path,
}

pub async fn run(toolkit: &mut Toolkit, command: SettingsCommand, json: bool) -> Result<()> {
    match command {
        SettingsCommand::Show => show(toolkit, json).await,
        SettingsCommand::Set { key, value } => set(toolkit, &key, value).await,
        SettingsCommand::Path => path(toolkit).await,
    }
}

async fn show(toolkit: &Toolkit, json: bool) -> Result<()> {
    let settings = toolkit.settings().await?;
    if json {
        return print_json(&settings);
    }
    let mut table = Table::new(&["SETTING", "VALUE"]);
    for (key, value) in flatten(&serde_json::to_value(&settings)?) {
        table.row(vec![key, value]);
    }
    table.print();
    Ok(())
}

async fn set(toolkit: &Toolkit, key: &str, raw: String) -> Result<()> {
    let settings = toolkit.settings().await?;
    let mut document = serde_json::to_value(&settings)?;
    let target = locate(&mut document, key)?;

    let mut value: Value = serde_json::from_str(&raw).unwrap_or(Value::String(raw.clone()));
    // `tbt settings set lslStreamName 42` should still store text, not a number.
    if target.is_string() && !value.is_string() {
        value = Value::String(raw.clone());
    }
    if target.is_object() {
        bail!("'{key}' is a group of settings; set one of its members (see `tbt settings show`).");
    }
    *target = value;

    let updated: GeneralSettings = serde_json::from_value(document)
        .with_context(|| format!("'{raw}' is not a valid value for {key}"))?;
    toolkit
        .request(|response| ToolkitCommand::SaveSettings {
            settings: updated,
            response,
        })
        .await
        .context("The settings could not be saved (details in the log above)")?;

    let saved = toolkit.settings().await?;
    let shown = flatten(&serde_json::to_value(&saved)?)
        .into_iter()
        .find(|(k, _)| k == key)
        .map(|(_, v)| v)
        .unwrap_or_default();
    println!("{key} = {shown}");
    Ok(())
}

async fn path(toolkit: &Toolkit) -> Result<()> {
    let settings = toolkit.settings().await?;
    let app_dir = file_system::app_dir();
    println!("Application directory:     {}", app_dir.display());
    println!(
        "Settings file:             {}",
        app_dir.join("settings.json").display()
    );
    println!(
        "Default session directory: {}",
        settings.store_files_default_directory.display()
    );
    println!();
    println!(
        "Set TBT_APP_DIR to move the application directory (settings, users, devices, activities)."
    );
    Ok(())
}

/// `{"a": {"b": 1}}` becomes `[("a.b", "1")]`. Strings lose their quotes.
fn flatten(value: &Value) -> Vec<(String, String)> {
    fn walk(prefix: &str, value: &Value, out: &mut Vec<(String, String)>) {
        match value {
            Value::Object(map) => {
                for (key, inner) in map {
                    let path = if prefix.is_empty() {
                        key.clone()
                    } else {
                        format!("{prefix}.{key}")
                    };
                    walk(&path, inner, out);
                }
            }
            Value::String(text) => out.push((prefix.to_string(), text.clone())),
            other => out.push((prefix.to_string(), other.to_string())),
        }
    }
    let mut out = Vec::new();
    walk("", value, &mut out);
    out
}

fn locate<'a>(document: &'a mut Value, key: &str) -> Result<&'a mut Value> {
    let mut current = document;
    for segment in key.split('.') {
        current = match current {
            Value::Object(map) => map.get_mut(segment).with_context(|| {
                format!("Unknown setting '{key}'. Run `tbt settings show` to list them.")
            })?,
            _ => bail!("Unknown setting '{key}'. Run `tbt settings show` to list them."),
        };
    }
    Ok(current)
}
