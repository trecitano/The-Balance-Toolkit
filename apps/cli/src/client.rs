//! Thin handle over the toolkit manager: request/response plumbing plus the lookups every
//! command needs (boards by name or MAC, users by id or name, waiting for boards to come up).

use anyhow::{Context, Result, anyhow, bail};
use std::time::{Duration, Instant};
use tokio::sync::mpsc::{Receiver, Sender};
use tokio::sync::oneshot;
use toolkit_core::actors::state::activities::Activity;
use toolkit_core::types::{GeneralSettings, MacAddress, NintendoDevice, SelectOption};
use toolkit_core::utils::mac_address_human_name;
use toolkit_core::{ToolkitCommand, ToolkitResponse};

pub struct Toolkit {
    pub commands: Sender<ToolkitCommand>,
    pub events: Receiver<ToolkitResponse>,
}

impl Toolkit {
    pub fn start() -> Result<Self> {
        let (commands, events) = toolkit_core::start_manager()?;
        Ok(Self { commands, events })
    }

    pub async fn request<T>(
        &self,
        build: impl FnOnce(oneshot::Sender<T>) -> ToolkitCommand,
    ) -> Result<T> {
        toolkit_core::request(&self.commands, build).await
    }

    pub async fn send(&self, command: ToolkitCommand) -> Result<()> {
        toolkit_core::send(&self.commands, command).await
    }

    /// Waits until every command sent so far has been handled. The manager processes its
    /// queue in order, so a completed round trip proves the earlier fire-and-forget commands
    /// went through before the process exits.
    pub async fn flush(&self) -> Result<()> {
        self.settings().await.map(|_| ())
    }

    pub async fn settings(&self) -> Result<GeneralSettings> {
        self.request(|response| ToolkitCommand::GetSettings { response })
            .await
    }

    /// Every board the toolkit knows about. As a side effect the manager opens a HID
    /// connection to any board the operating system reports as connected.
    pub async fn boards(&self) -> Result<Vec<NintendoDevice>> {
        self.request(|response| ToolkitCommand::GetBoardsSystemView { response })
            .await
    }

    pub async fn activities(&self) -> Result<Vec<Activity>> {
        self.request(|response| ToolkitCommand::GetActivities { response })
            .await
    }

    /// Adds boards to the session, waiting for HID connections that are still being
    /// established. `GetBoardsSystemView` retries failed connections, so it is re-run while
    /// waiting.
    pub async fn select_boards_for_session(
        &mut self,
        boards: &[MacAddress],
        timeout: Duration,
    ) -> Result<()> {
        let deadline = Instant::now() + timeout;
        loop {
            for &mac_address in boards {
                self.send(ToolkitCommand::SelectBoardForSession { mac_address })
                    .await?;
            }
            let selected: Vec<MacAddress> = self
                .request(|response| ToolkitCommand::SelectedBoardsForSession { response })
                .await?;
            let missing: Vec<String> = boards
                .iter()
                .filter(|mac_address| !selected.contains(mac_address))
                .map(|&mac_address| mac_address_human_name(mac_address))
                .collect();
            if missing.is_empty() {
                return Ok(());
            }
            if Instant::now() >= deadline {
                bail!(
                    "Board(s) {} did not connect within {}s. Check the board is powered on and \
                     paired (`tbt devices list`), then try again.",
                    missing.join(", "),
                    timeout.as_secs()
                );
            }

            tokio::select! {
                _ = tokio::time::sleep(Duration::from_millis(500)) => {}
                _ = self.events.recv() => {}
            }
            self.boards().await?;
        }
    }
}

/// Parses `aa:bb:cc:dd:ee:ff`, `aa-bb-cc-dd-ee-ff` or `aabbccddeeff`.
pub fn parse_mac_address(text: &str) -> Option<MacAddress> {
    let digits: String = text
        .chars()
        .filter(|c| !matches!(c, ':' | '-' | '.'))
        .collect();
    if digits.len() != 12 {
        return None;
    }
    u64::from_str_radix(&digits, 16).ok()
}

/// Finds a board by MAC address, by name (case-insensitive) or by a unique prefix of either.
pub fn resolve_board<'a>(
    boards: &'a [NintendoDevice],
    reference: &str,
) -> Result<&'a NintendoDevice> {
    if let Some(mac_address) = parse_mac_address(reference) {
        return boards
            .iter()
            .find(|board| board.mac_address == mac_address)
            .ok_or_else(|| {
                anyhow!(
                    "No board with address {} is known. Pair it with `tbt devices scan`.",
                    mac_address_human_name(mac_address)
                )
            });
    }

    let wanted = reference.trim().to_lowercase();
    let by_name: Vec<&NintendoDevice> = boards
        .iter()
        .filter(|board| board.name.to_lowercase() == wanted)
        .collect();
    match by_name.as_slice() {
        [board] => return Ok(board),
        [_, _, ..] => bail!(
            "Several boards are named '{reference}'. Use the MAC address instead (`tbt devices list`)."
        ),
        [] => {}
    }

    let compact = wanted.replace([':', '-', '.'], "");
    let by_prefix: Vec<&NintendoDevice> = boards
        .iter()
        .filter(|board| {
            let mac = mac_address_human_name(board.mac_address);
            mac.starts_with(&wanted)
                || mac.replace(':', "").starts_with(&compact)
                || board.name.to_lowercase().starts_with(&wanted)
        })
        .collect();
    match by_prefix.as_slice() {
        [board] => Ok(board),
        [] => bail!("No board matches '{reference}'. See `tbt devices list`."),
        _ => bail!("'{reference}' matches more than one board. See `tbt devices list`."),
    }
}

/// Finds a user by id or by name (case-insensitive).
pub fn resolve_user(users: &[SelectOption<usize>], reference: &str) -> Result<usize> {
    if let Ok(id) = reference.parse::<usize>() {
        return users
            .iter()
            .find(|user| user.value == id)
            .map(|user| user.value)
            .ok_or_else(|| anyhow!("No user with id {id}. See `tbt users list`."));
    }
    let wanted = reference.trim().to_lowercase();
    let matches: Vec<&SelectOption<usize>> = users
        .iter()
        .filter(|user| user.label.to_lowercase() == wanted)
        .collect();
    match matches.as_slice() {
        [user] => Ok(user.value),
        [] => bail!("No user named '{reference}'. See `tbt users list`."),
        _ => bail!("Several users are named '{reference}'. Use the id instead (`tbt users list`)."),
    }
}

pub fn find_activity<'a>(activities: &'a [Activity], id: &str) -> Result<&'a Activity> {
    activities
        .iter()
        .find(|activity| activity.id == id)
        .with_context(|| {
            let known: Vec<&str> = activities.iter().map(|a| a.id.as_str()).collect();
            format!("Unknown activity '{id}'. Available: {}", known.join(", "))
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn board(name: &str, mac_address: MacAddress) -> NintendoDevice {
        NintendoDevice {
            id: name.into(),
            name: name.into(),
            mac_address,
            is_connected: true,
            last_connected: None,
        }
    }

    #[test]
    fn board_references_resolve_names_and_mac_formats() {
        let boards = [
            board("Left board", 0x37fea12bfdf4),
            board("Right board", 0x12e9cdb97154),
        ];
        for reference in [
            "left BOARD",
            "Left",
            "37:fe:a1:2b:fd:f4",
            "37-FE-A1-2B-FD-F4",
            "37fea12bfdf4",
        ] {
            assert_eq!(
                resolve_board(&boards, reference).unwrap().mac_address,
                boards[0].mac_address
            );
        }
    }

    #[test]
    fn ambiguous_and_unknown_boards_are_rejected() {
        let boards = [board("Board left", 1), board("Board right", 2)];
        assert!(resolve_board(&boards, "Board").is_err());
        assert!(resolve_board(&boards, "Missing").is_err());
        assert!(parse_mac_address("not-a-mac").is_none());
    }
}
