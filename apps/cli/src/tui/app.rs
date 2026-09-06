//! Dashboard state and behaviour: what the keys do, how a recording or replay is driven, and
//! what the toolkit manager reports back. Rendering lives in `ui.rs`.

use anyhow::{Context, Result, bail};
use ratatui::crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
use std::collections::{BTreeMap, BTreeSet, HashMap, VecDeque};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use tokio::sync::mpsc;
use toolkit_core::actors::balance_board_actor::{BalanceBoardOutput, BoardAction};
use toolkit_core::actors::bluetooth_service::{BluetoothCommand, BluetoothPeripheral};
use toolkit_core::actors::state::activities::Activity;
use toolkit_core::file_system::ExistingSessionFileSystem;
use toolkit_core::processing::data_processor::InterpolationSetting;
use toolkit_core::types::{
    FrontendCoreSession, GeneralSettings, MacAddress, NintendoDevice, SelectOption,
    SessionActivityState,
};
use toolkit_core::utils::mac_address_human_name;
use toolkit_core::{ToolkitCommand, ToolkitResponse};

use crate::client::Toolkit;
use crate::commands::session::{Kind, RecordingWatch, prepare_output_directory};
use crate::commands::settings::{apply_setting, flatten};
use crate::tui::logger::LogBuffer;

/// How long the dashboard waits for selected boards to open their HID connection.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
/// How often the board list is refreshed from the manager while idle. The desktop app only
/// refetches on events, and each refresh may touch the Bluetooth stack, so keep it modest.
const BOARD_REFRESH: Duration = Duration::from_secs(5);
/// Number of centre-of-pressure points kept for the trail drawn behind the live marker.
const TRAIL_LENGTH: usize = 240;
/// Number of weight samples kept for the sparkline.
const HISTORY_LENGTH: usize = 200;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Tab {
    Boards,
    Session,
    Replay,
    Settings,
}

impl Tab {
    pub const ALL: [Tab; 4] = [Tab::Boards, Tab::Session, Tab::Replay, Tab::Settings];

    pub fn title(self) -> &'static str {
        match self {
            Tab::Boards => "Boards",
            Tab::Session => "Session",
            Tab::Replay => "Replay",
            Tab::Settings => "Settings",
        }
    }

    pub fn index(self) -> usize {
        Tab::ALL.iter().position(|tab| *tab == self).unwrap_or(0)
    }

    fn next(self) -> Tab {
        Tab::ALL[(self.index() + 1) % Tab::ALL.len()]
    }

    fn previous(self) -> Tab {
        Tab::ALL[(self.index() + Tab::ALL.len() - 1) % Tab::ALL.len()]
    }
}

/// The editable rows of the Session tab, in display order.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SessionField {
    Boards,
    User,
    Activity,
    Duration,
    TareFirst,
    Tcp,
    Lsl,
    Output,
    WindowSize,
    WindowSlide,
    SamplingRate,
    Interpolation,
}

impl SessionField {
    pub const ALL: [SessionField; 12] = [
        SessionField::Boards,
        SessionField::User,
        SessionField::Activity,
        SessionField::Duration,
        SessionField::TareFirst,
        SessionField::Tcp,
        SessionField::Lsl,
        SessionField::Output,
        SessionField::WindowSize,
        SessionField::WindowSlide,
        SessionField::SamplingRate,
        SessionField::Interpolation,
    ];

    pub fn label(self) -> &'static str {
        match self {
            SessionField::Boards => "Boards",
            SessionField::User => "User",
            SessionField::Activity => "Activity",
            SessionField::Duration => "Duration",
            SessionField::TareFirst => "Tare first",
            SessionField::Tcp => "TCP stream",
            SessionField::Lsl => "LSL stream",
            SessionField::Output => "Output",
            SessionField::WindowSize => "Window size",
            SessionField::WindowSlide => "Window slide",
            SessionField::SamplingRate => "Sampling rate",
            SessionField::Interpolation => "Interpolation",
        }
    }
}

/// What a modal dialog does once it is confirmed, submitted or picked from.
#[derive(Clone, Debug)]
pub enum Action {
    Forget(MacAddress),
    Rename(MacAddress),
    SetDuration,
    SetOutput,
    SetWindowSize,
    SetWindowSlide,
    SetSamplingRate,
    PickUser,
    PickActivity,
    PickInterpolation,
    SetSetting(String),
    Quit,
}

#[derive(Clone, Debug)]
pub enum Modal {
    Help,
    Confirm {
        title: String,
        text: String,
        action: Action,
    },
    Prompt {
        title: String,
        value: String,
        action: Action,
    },
    Picker {
        title: String,
        items: Vec<String>,
        cursor: usize,
        action: Action,
    },
}

/// A recording found in the session directory, for the Replay tab.
#[derive(Clone, Debug)]
pub struct Recording {
    pub path: PathBuf,
    pub file_name: String,
    pub user: String,
    pub boards: usize,
    pub duration: Duration,
    pub activity: Option<String>,
}

/// Live figures for one board during a recording or replay.
#[derive(Debug)]
pub struct BoardLive {
    pub name: String,
    pub weight_kg: f32,
    pub max_weight_kg: f32,
    pub cop: (f32, f32),
    pub trail: VecDeque<(f64, f64)>,
    pub weight_history: VecDeque<u64>,
    pub raw_samples: u64,
    pub processed_samples: u64,
    pub stability_index: Option<f32>,
    pub dpsi: Option<f32>,
    pub mean_velocity: Option<f32>,
}

impl BoardLive {
    fn new(name: String) -> Self {
        Self {
            name,
            weight_kg: 0.0,
            max_weight_kg: 0.0,
            cop: (0.0, 0.0),
            trail: VecDeque::with_capacity(TRAIL_LENGTH),
            weight_history: VecDeque::with_capacity(HISTORY_LENGTH),
            raw_samples: 0,
            processed_samples: 0,
            stability_index: None,
            dpsi: None,
            mean_velocity: None,
        }
    }
}

/// A recording or replay in progress.
pub struct Run {
    pub kind: Kind,
    data_rx: Option<mpsc::Receiver<BalanceBoardOutput>>,
    pub started: Instant,
    /// The planned length: the `--duration` of a session, or the recorded length of a replay.
    pub planned: Option<Duration>,
    pub boards: BTreeMap<MacAddress, BoardLive>,
    names: HashMap<MacAddress, String>,
    pub activity: Option<SessionActivityState>,
    has_activity: bool,
    pub stopping: bool,
    watch: RecordingWatch,
    last_activity_poll: Instant,
}

impl Run {
    pub fn elapsed(&self) -> Duration {
        self.started.elapsed()
    }

    pub fn raw_samples(&self) -> u64 {
        self.boards.values().map(|b| b.raw_samples).sum()
    }

    fn record(&mut self, sample: BalanceBoardOutput) {
        let mac_address = sample.mac_address();
        let name = self
            .names
            .get(&mac_address)
            .cloned()
            .unwrap_or_else(|| mac_address_human_name(mac_address));
        let live = self
            .boards
            .entry(mac_address)
            .or_insert_with(|| BoardLive::new(name));
        match sample {
            BalanceBoardOutput::Raw(reading) => {
                let cop = reading.calculate_cop();
                live.raw_samples += 1;
                live.weight_kg = reading.top_left
                    + reading.top_right
                    + reading.bottom_left
                    + reading.bottom_right;
                live.max_weight_kg = live.max_weight_kg.max(live.weight_kg);
                live.cop = (cop.x, cop.y);
                if live.trail.len() == TRAIL_LENGTH {
                    live.trail.pop_front();
                }
                live.trail.push_back((cop.x as f64, cop.y as f64));
                if live.raw_samples.is_multiple_of(5) {
                    if live.weight_history.len() == HISTORY_LENGTH {
                        live.weight_history.pop_front();
                    }
                    live.weight_history
                        .push_back(live.weight_kg.max(0.0).round() as u64);
                }
            }
            BalanceBoardOutput::Processed(data) => {
                live.processed_samples += 1;
                live.stability_index = data.stability_index;
                live.dpsi = data.dpsi_metrics.as_ref().map(|m| m.dpsi);
                live.mean_velocity = data.sway_metrics.as_ref().map(|m| m.mean_velocity);
            }
        }
    }
}

pub enum Phase {
    Idle,
    /// Boards are being added to the session; the manager retries their HID connections.
    Connecting {
        boards: Vec<MacAddress>,
        deadline: Instant,
        next_attempt: Instant,
    },
    Running(Box<Run>),
    /// The run has stopped; waiting for the file writer to finalise the recording.
    Finishing {
        kind: Kind,
        watch: RecordingWatch,
        deadline: Instant,
    },
}

pub struct App {
    pub toolkit: Toolkit,
    pub log: LogBuffer,
    pub tab: Tab,
    pub modal: Option<Modal>,
    pub should_quit: bool,
    quit_after_finish: bool,

    pub settings: GeneralSettings,
    pub boards: Vec<NintendoDevice>,
    pub board_cursor: usize,
    pub selected: BTreeSet<MacAddress>,
    pub scanning: bool,
    last_board_refresh: Instant,

    pub core: FrontendCoreSession,
    pub users: Vec<SelectOption<usize>>,
    pub activities: Vec<Activity>,
    pub duration_secs: Option<u64>,
    pub tare_first: bool,
    pub session_cursor: usize,
    pub phase: Phase,
    /// What the previous run produced, shown on the Session tab while idle.
    pub last_run: Vec<String>,

    pub recordings: Vec<Recording>,
    pub replay_cursor: usize,

    pub settings_rows: Vec<(String, String)>,
    pub settings_cursor: usize,
}

impl App {
    pub async fn new(toolkit: Toolkit, log: LogBuffer) -> Result<Self> {
        let settings = toolkit.settings().await?;
        let boards = toolkit.boards().await?;
        let info = toolkit
            .request(|response| ToolkitCommand::SessionInformation { response })
            .await?;
        let activities = toolkit.activities().await?;
        let mut core = info.core;
        if core.output_directory.as_os_str().is_empty() {
            core.output_directory = settings.store_files_default_directory.clone();
        }
        let selected = boards
            .iter()
            .filter(|b| b.is_connected)
            .map(|b| b.mac_address)
            .collect();
        let mut app = Self {
            toolkit,
            log,
            tab: Tab::Boards,
            modal: None,
            should_quit: false,
            quit_after_finish: false,
            settings_rows: Vec::new(),
            settings,
            boards,
            board_cursor: 0,
            selected,
            scanning: false,
            last_board_refresh: Instant::now(),
            core,
            users: info.available_users,
            activities,
            duration_secs: None,
            tare_first: false,
            session_cursor: 0,
            phase: Phase::Idle,
            last_run: Vec::new(),
            recordings: Vec::new(),
            replay_cursor: 0,
            settings_cursor: 0,
        };
        app.reload_settings_rows()?;
        app.reload_recordings();
        app.log.info("Press ? for help, q to quit.");
        if app.settings.is_demo_mode {
            app.log
                .warn("Demo mode is on: the boards are simulated (Settings tab, isDemoMode).");
        }
        Ok(app)
    }

    // ------------------------------------------------------------------------------------
    // Derived state used by the renderer
    // ------------------------------------------------------------------------------------

    pub fn is_running(&self) -> bool {
        !matches!(self.phase, Phase::Idle)
    }

    pub fn user_label(&self) -> String {
        self.users
            .iter()
            .find(|u| u.value == self.core.selected_user)
            .map(|u| u.label.clone())
            .unwrap_or_else(|| format!("#{}", self.core.selected_user))
    }

    pub fn activity(&self) -> Option<&Activity> {
        let id = self.core.activity_id.as_deref()?;
        self.activities.iter().find(|a| a.id == id)
    }

    pub fn selected_boards(&self) -> Vec<&NintendoDevice> {
        self.boards
            .iter()
            .filter(|b| self.selected.contains(&b.mac_address))
            .collect()
    }

    pub fn current_board(&self) -> Option<&NintendoDevice> {
        self.boards.get(self.board_cursor)
    }

    // ------------------------------------------------------------------------------------
    // Input
    // ------------------------------------------------------------------------------------

    pub async fn handle_key(&mut self, key: KeyEvent) -> Result<()> {
        if let Some(modal) = self.modal.take() {
            return self.handle_modal_key(modal, key).await;
        }
        if key.modifiers.contains(KeyModifiers::CONTROL) && key.code == KeyCode::Char('c') {
            self.request_quit();
            return Ok(());
        }
        match key.code {
            KeyCode::Char('q') => self.request_quit(),
            KeyCode::Char('?') | KeyCode::F(1) => self.modal = Some(Modal::Help),
            KeyCode::Tab | KeyCode::Right => self.switch_tab(self.tab.next()),
            KeyCode::BackTab | KeyCode::Left => self.switch_tab(self.tab.previous()),
            KeyCode::Char('1') => self.switch_tab(Tab::Boards),
            KeyCode::Char('2') => self.switch_tab(Tab::Session),
            KeyCode::Char('3') => self.switch_tab(Tab::Replay),
            KeyCode::Char('4') => self.switch_tab(Tab::Settings),
            KeyCode::Char('s') | KeyCode::Esc if matches!(self.phase, Phase::Running(_)) => {
                self.stop_run().await?;
            }
            _ => match self.tab {
                Tab::Boards => self.boards_key(key).await?,
                Tab::Session => self.session_key(key).await?,
                Tab::Replay => self.replay_key(key).await?,
                Tab::Settings => self.settings_key(key).await?,
            },
        }
        Ok(())
    }

    fn switch_tab(&mut self, tab: Tab) {
        self.tab = tab;
        if tab == Tab::Replay {
            self.reload_recordings();
        }
    }

    fn request_quit(&mut self) {
        if let Phase::Running(_) = self.phase {
            self.modal = Some(Modal::Confirm {
                title: "Quit".into(),
                text: "A run is in progress. Stop it and quit?".into(),
                action: Action::Quit,
            });
        } else {
            self.should_quit = true;
        }
    }

    async fn handle_modal_key(&mut self, modal: Modal, key: KeyEvent) -> Result<()> {
        match modal {
            Modal::Help => {}
            Modal::Confirm {
                title,
                text,
                action,
            } => match key.code {
                KeyCode::Char('y') | KeyCode::Char('Y') | KeyCode::Enter => {
                    self.complete(action, Input::Confirmed).await?;
                }
                KeyCode::Char('n') | KeyCode::Esc | KeyCode::Char('q') => {}
                _ => {
                    self.modal = Some(Modal::Confirm {
                        title,
                        text,
                        action,
                    });
                }
            },
            Modal::Prompt {
                title,
                mut value,
                action,
            } => match key.code {
                KeyCode::Enter => self.complete(action, Input::Text(value)).await?,
                KeyCode::Esc => {}
                KeyCode::Backspace => {
                    value.pop();
                    self.modal = Some(Modal::Prompt {
                        title,
                        value,
                        action,
                    });
                }
                KeyCode::Char('u') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                    value.clear();
                    self.modal = Some(Modal::Prompt {
                        title,
                        value,
                        action,
                    });
                }
                KeyCode::Char(c) if !key.modifiers.contains(KeyModifiers::CONTROL) => {
                    value.push(c);
                    self.modal = Some(Modal::Prompt {
                        title,
                        value,
                        action,
                    });
                }
                _ => {
                    self.modal = Some(Modal::Prompt {
                        title,
                        value,
                        action,
                    });
                }
            },
            Modal::Picker {
                title,
                items,
                mut cursor,
                action,
            } => match key.code {
                KeyCode::Enter => self.complete(action, Input::Choice(cursor)).await?,
                KeyCode::Esc | KeyCode::Char('q') => {}
                code => {
                    match code {
                        KeyCode::Up | KeyCode::Char('k') => cursor = cursor.saturating_sub(1),
                        KeyCode::Down | KeyCode::Char('j') => {
                            cursor = (cursor + 1).min(items.len().saturating_sub(1));
                        }
                        _ => {}
                    }
                    self.modal = Some(Modal::Picker {
                        title,
                        items,
                        cursor,
                        action,
                    });
                }
            },
        }
        Ok(())
    }

    async fn complete(&mut self, action: Action, input: Input) -> Result<()> {
        match (action, input) {
            (Action::Quit, Input::Confirmed) => {
                self.quit_after_finish = true;
                self.stop_run().await?;
            }
            (Action::Forget(mac_address), Input::Confirmed) => {
                self.toolkit
                    .send(ToolkitCommand::BluetoothAction(
                        BluetoothCommand::RemoveDevice { mac_address },
                    ))
                    .await?;
                self.toolkit.flush().await?;
                self.selected.remove(&mac_address);
                self.log
                    .info(format!("Forgot {}.", mac_address_human_name(mac_address)));
                self.refresh_boards().await?;
            }
            (Action::Rename(mac_address), Input::Text(name)) => {
                let name = name.trim().to_string();
                if name.is_empty() {
                    bail!("A board name cannot be empty.");
                }
                self.toolkit
                    .send(ToolkitCommand::UpdateBoardName {
                        mac_address,
                        device_name: name.clone(),
                    })
                    .await?;
                self.toolkit.flush().await?;
                self.log.info(format!(
                    "Renamed {} to {name}.",
                    mac_address_human_name(mac_address)
                ));
                self.refresh_boards().await?;
            }
            (Action::SetDuration, Input::Text(text)) => {
                let text = text.trim();
                self.duration_secs = if text.is_empty() {
                    None
                } else {
                    Some(parse_number(text, "duration")?)
                };
            }
            (Action::SetOutput, Input::Text(text)) => {
                let text = text.trim();
                self.core.output_directory = if text.is_empty() {
                    self.settings.store_files_default_directory.clone()
                } else {
                    PathBuf::from(text)
                };
            }
            (Action::SetWindowSize, Input::Text(text)) => {
                self.core.window_size_ms = parse_number(&text, "window size")?;
            }
            (Action::SetWindowSlide, Input::Text(text)) => {
                self.core.window_slide_ms = parse_number(&text, "window slide")?;
            }
            (Action::SetSamplingRate, Input::Text(text)) => {
                self.core.sampling_rate = parse_number(&text, "sampling rate")?;
            }
            (Action::PickUser, Input::Choice(index)) => {
                if let Some(user) = self.users.get(index) {
                    self.core.selected_user = user.value;
                }
            }
            (Action::PickActivity, Input::Choice(index)) => {
                self.core.activity_id = if index == 0 {
                    None
                } else {
                    self.activities.get(index - 1).map(|a| a.id.clone())
                };
                if self.core.activity_id.is_some() {
                    // An activity decides when the session ends.
                    self.duration_secs = None;
                }
            }
            (Action::PickInterpolation, Input::Choice(index)) => {
                self.core.interpolation = match index {
                    0 => InterpolationSetting::Linear,
                    1 => InterpolationSetting::Cubic,
                    _ => InterpolationSetting::Polynomial,
                };
            }
            (Action::SetSetting(key), Input::Text(text)) => {
                self.save_setting(&key, &text).await?;
            }
            _ => {}
        }
        Ok(())
    }

    // ------------------------------------------------------------------------------------
    // Boards tab
    // ------------------------------------------------------------------------------------

    async fn boards_key(&mut self, key: KeyEvent) -> Result<()> {
        match key.code {
            KeyCode::Up | KeyCode::Char('k') => {
                self.board_cursor = self.board_cursor.saturating_sub(1);
            }
            KeyCode::Down | KeyCode::Char('j') => {
                self.board_cursor =
                    (self.board_cursor + 1).min(self.boards.len().saturating_sub(1));
            }
            KeyCode::Char(' ') | KeyCode::Enter => {
                if let Some(board) = self.current_board() {
                    let mac_address = board.mac_address;
                    if !self.selected.remove(&mac_address) {
                        self.selected.insert(mac_address);
                    }
                }
            }
            KeyCode::Char('s') => self.toggle_scan().await?,
            KeyCode::Char('i') => {
                let board = self.connected_board_under_cursor("blink")?;
                self.toolkit
                    .send(ToolkitCommand::IdentifyBoard {
                        mac_address: board.mac_address,
                    })
                    .await?;
                self.log.info(format!(
                    "Blinking the LED of {} for ten seconds.",
                    board.name
                ));
            }
            KeyCode::Char('t') => {
                let board = self.connected_board_under_cursor("be tared")?;
                self.toolkit
                    .send(ToolkitCommand::BoardAction {
                        mac_address: board.mac_address,
                        action: BoardAction::Tare,
                    })
                    .await?;
                self.toolkit.flush().await?;
                self.log.info(format!("Tared {}.", board.name));
            }
            KeyCode::Char('n') => {
                if let Some(board) = self.current_board() {
                    self.modal = Some(Modal::Prompt {
                        title: format!(
                            "New name for {}",
                            mac_address_human_name(board.mac_address)
                        ),
                        value: board.name.clone(),
                        action: Action::Rename(board.mac_address),
                    });
                }
            }
            KeyCode::Char('f') | KeyCode::Delete => {
                if let Some(board) = self.current_board() {
                    self.modal = Some(Modal::Confirm {
                        title: "Forget board".into(),
                        text: format!(
                            "Remove the pairing of {} ({})?",
                            board.name,
                            mac_address_human_name(board.mac_address)
                        ),
                        action: Action::Forget(board.mac_address),
                    });
                }
            }
            KeyCode::Char('r') | KeyCode::F(5) => {
                self.refresh_boards().await?;
                self.log.info("Board list refreshed.");
            }
            _ => {}
        }
        Ok(())
    }

    fn connected_board_under_cursor(&self, verb: &str) -> Result<NintendoDevice> {
        let board = self
            .current_board()
            .context("No board is selected. Pair one with s.")?;
        if !board.is_connected {
            bail!(
                "{} is not connected; only a connected board can {verb}.",
                board.name
            );
        }
        Ok(board.clone())
    }

    async fn refresh_boards(&mut self) -> Result<()> {
        self.boards = self.toolkit.boards().await?;
        self.board_cursor = self.board_cursor.min(self.boards.len().saturating_sub(1));
        self.last_board_refresh = Instant::now();
        Ok(())
    }

    async fn toggle_scan(&mut self) -> Result<()> {
        if self.scanning {
            self.toolkit
                .request(|response| {
                    ToolkitCommand::BluetoothAction(BluetoothCommand::StopScan { response })
                })
                .await?;
            self.scanning = false;
            self.log.info("Scan stopped.");
            self.refresh_boards().await?;
            return Ok(());
        }

        // Same flow as the desktop app: Bluetooth pairing first, then the manager opens the
        // board over HID and reports it with `NewDeviceFound`.
        let (paired_tx, mut paired_rx) = mpsc::channel::<BluetoothPeripheral>(10);
        let commands = self.toolkit.commands.clone();
        let log = self.log.clone();
        tokio::spawn(async move {
            while let Some(peripheral) = paired_rx.recv().await {
                log.info(format!(
                    "Paired {} ({}), connecting...",
                    peripheral.name,
                    mac_address_human_name(peripheral.mac_address)
                ));
                let command = ToolkitCommand::Connect {
                    mac_address: peripheral.mac_address,
                };
                if commands.send(command).await.is_err() {
                    break;
                }
            }
        });
        self.toolkit
            .request(|response| {
                ToolkitCommand::BluetoothAction(BluetoothCommand::StartScanAndPair {
                    response_stream: paired_tx,
                    response,
                })
            })
            .await?;
        self.scanning = true;
        self.log.info(
            "Scanning. Press the red SYNC button inside each board's battery compartment; s stops.",
        );
        Ok(())
    }

    // ------------------------------------------------------------------------------------
    // Session tab
    // ------------------------------------------------------------------------------------

    async fn session_key(&mut self, key: KeyEvent) -> Result<()> {
        match key.code {
            KeyCode::Up | KeyCode::Char('k') => {
                self.session_cursor = self.session_cursor.saturating_sub(1);
            }
            KeyCode::Down | KeyCode::Char('j') => {
                self.session_cursor = (self.session_cursor + 1).min(SessionField::ALL.len() - 1);
            }
            KeyCode::Enter | KeyCode::Char(' ') => self.edit_session_field(),
            KeyCode::Char('r') => self.start_session().await?,
            _ => {}
        }
        Ok(())
    }

    fn edit_session_field(&mut self) {
        if self.is_running() {
            return;
        }
        match SessionField::ALL[self.session_cursor] {
            SessionField::Boards => self.tab = Tab::Boards,
            SessionField::User => {
                let cursor = self
                    .users
                    .iter()
                    .position(|u| u.value == self.core.selected_user)
                    .unwrap_or(0);
                self.modal = Some(Modal::Picker {
                    title: "User".into(),
                    items: self.users.iter().map(|u| u.label.clone()).collect(),
                    cursor,
                    action: Action::PickUser,
                });
            }
            SessionField::Activity => {
                let mut items = vec!["none (free recording)".to_string()];
                items.extend(self.activities.iter().map(|a| {
                    format!(
                        "{} ({} board(s), {})",
                        a.title,
                        a.boards_required,
                        crate::output::format_duration(activity_duration(a))
                    )
                }));
                let cursor = self
                    .core
                    .activity_id
                    .as_deref()
                    .and_then(|id| self.activities.iter().position(|a| a.id == id))
                    .map_or(0, |i| i + 1);
                self.modal = Some(Modal::Picker {
                    title: "Activity".into(),
                    items,
                    cursor,
                    action: Action::PickActivity,
                });
            }
            SessionField::Duration => {
                if self.core.activity_id.is_some() {
                    self.log.warn(
                        "The activity decides when the session ends; clear it to set a duration.",
                    );
                    return;
                }
                self.modal = Some(Modal::Prompt {
                    title: "Duration in seconds (empty: until stopped)".into(),
                    value: self
                        .duration_secs
                        .map(|d| d.to_string())
                        .unwrap_or_default(),
                    action: Action::SetDuration,
                });
            }
            SessionField::TareFirst => self.tare_first = !self.tare_first,
            SessionField::Tcp => self.core.tcp_enabled = !self.core.tcp_enabled,
            SessionField::Lsl => self.core.lsl_enabled = !self.core.lsl_enabled,
            SessionField::Output => {
                self.modal = Some(Modal::Prompt {
                    title: "Output directory (empty: the settings' session directory)".into(),
                    value: self.core.output_directory.display().to_string(),
                    action: Action::SetOutput,
                });
            }
            SessionField::WindowSize => {
                self.modal = Some(Modal::Prompt {
                    title: "Analysis window length in milliseconds".into(),
                    value: self.core.window_size_ms.to_string(),
                    action: Action::SetWindowSize,
                });
            }
            SessionField::WindowSlide => {
                self.modal = Some(Modal::Prompt {
                    title: "Window slide in milliseconds".into(),
                    value: self.core.window_slide_ms.to_string(),
                    action: Action::SetWindowSlide,
                });
            }
            SessionField::SamplingRate => {
                self.modal = Some(Modal::Prompt {
                    title: "Sampling rate of the processed stream in hertz".into(),
                    value: self.core.sampling_rate.to_string(),
                    action: Action::SetSamplingRate,
                });
            }
            SessionField::Interpolation => {
                let cursor = match self.core.interpolation {
                    InterpolationSetting::Linear => 0,
                    InterpolationSetting::Cubic => 1,
                    InterpolationSetting::Polynomial => 2,
                };
                self.modal = Some(Modal::Picker {
                    title: "Interpolation".into(),
                    items: vec!["Linear".into(), "Cubic".into(), "Polynomial".into()],
                    cursor,
                    action: Action::PickInterpolation,
                });
            }
        }
    }

    async fn start_session(&mut self) -> Result<()> {
        if self.is_running() {
            bail!("A run is already in progress.");
        }
        self.refresh_boards().await?;
        let mut targets: Vec<&NintendoDevice> = self.selected_boards();
        if targets.is_empty() {
            targets = self.boards.iter().filter(|b| b.is_connected).collect();
            if targets.is_empty() {
                bail!(
                    "No board is connected. Pair one on the Boards tab (s) or power a paired board on."
                );
            }
            self.log
                .info("No board selected; recording from every connected board.");
        }
        if let Some(board) = targets.iter().find(|b| !b.is_connected) {
            bail!(
                "{} ({}) is not connected. Power it on; a paired board reconnects by itself.",
                board.name,
                mac_address_human_name(board.mac_address)
            );
        }
        let boards: Vec<MacAddress> = targets.iter().map(|b| b.mac_address).collect();
        self.selected = boards.iter().copied().collect();
        self.log
            .info(format!("Connecting to {} board(s)...", boards.len()));
        self.phase = Phase::Connecting {
            boards,
            deadline: Instant::now() + CONNECT_TIMEOUT,
            next_attempt: Instant::now(),
        };
        self.tab = Tab::Session;
        Ok(())
    }

    /// One attempt at adding the boards to the session. `GetBoardsSystemView` retries failed
    /// HID connections, so it is re-run between attempts.
    async fn connect_step(&mut self) -> Result<()> {
        let Phase::Connecting {
            boards,
            deadline,
            next_attempt,
        } = &self.phase
        else {
            return Ok(());
        };
        if Instant::now() < *next_attempt {
            return Ok(());
        }
        let boards = boards.clone();
        let deadline = *deadline;
        for &mac_address in &boards {
            self.toolkit
                .send(ToolkitCommand::SelectBoardForSession { mac_address })
                .await?;
        }
        let selected: Vec<MacAddress> = self
            .toolkit
            .request(|response| ToolkitCommand::SelectedBoardsForSession { response })
            .await?;
        let missing: Vec<String> = boards
            .iter()
            .filter(|mac_address| !selected.contains(mac_address))
            .map(|&mac_address| mac_address_human_name(mac_address))
            .collect();
        if missing.is_empty() {
            return self.begin_recording(&boards).await;
        }
        if Instant::now() >= deadline {
            self.phase = Phase::Idle;
            bail!(
                "Board(s) {} did not connect within {}s. Check the board is powered on and paired.",
                missing.join(", "),
                CONNECT_TIMEOUT.as_secs()
            );
        }
        self.phase = Phase::Connecting {
            boards,
            deadline,
            next_attempt: Instant::now() + Duration::from_millis(500),
        };
        self.refresh_boards().await
    }

    async fn begin_recording(&mut self, boards: &[MacAddress]) -> Result<()> {
        let started = async {
            self.settings = self.toolkit.settings().await?;
            if self.core.output_directory.as_os_str().is_empty() {
                self.core.output_directory = self.settings.store_files_default_directory.clone();
            }
            if let Some(id) = &self.core.activity_id
                && !self.activities.iter().any(|a| &a.id == id)
            {
                bail!("Unknown activity '{id}'.");
            }
            prepare_output_directory(&self.settings, &self.core.output_directory)?;
            let configuration = self.core.clone();
            self.toolkit
                .request(|response| ToolkitCommand::UpdateSessionInformation {
                    configuration,
                    response,
                })
                .await?;
            let info = self
                .toolkit
                .request(|response| ToolkitCommand::SessionInformation { response })
                .await?;
            self.users = info.available_users;

            if self.tare_first {
                self.log.info("Taring boards...");
                self.toolkit
                    .request(|response| ToolkitCommand::SessionTareDevices { response })
                    .await?;
            }
            let names: HashMap<MacAddress, String> = self
                .boards
                .iter()
                .filter(|b| boards.contains(&b.mac_address))
                .map(|b| (b.mac_address, b.name.clone()))
                .collect();
            let watch = RecordingWatch::before(
                &self.settings,
                &info.core.output_directory,
                boards.iter().copied(),
            );
            let (data_tx, data_rx) = mpsc::channel(2048);
            self.toolkit
                .request(|response| ToolkitCommand::StartSession {
                    frontend_channel: data_tx,
                    response,
                })
                .await?;
            Ok(Run {
                kind: Kind::Session,
                data_rx: Some(data_rx),
                started: Instant::now(),
                planned: self.duration_secs.map(Duration::from_secs),
                boards: BTreeMap::new(),
                names,
                activity: None,
                has_activity: info.activity.is_some(),
                stopping: false,
                watch,
                last_activity_poll: Instant::now(),
            })
        }
        .await;
        match started {
            Ok(run) => {
                self.log.info("Recording. Press s to stop.");
                self.phase = Phase::Running(Box::new(run));
                Ok(())
            }
            Err(error) => {
                self.phase = Phase::Idle;
                Err(error)
            }
        }
    }

    /// Asks the manager to stop the current run; the recording is then finalised on disk.
    async fn stop_run(&mut self) -> Result<()> {
        let Phase::Running(run) = &mut self.phase else {
            return Ok(());
        };
        if run.stopping {
            return Ok(());
        }
        run.stopping = true;
        let kind = run.kind;
        self.log.info("Stopping...");
        match kind {
            Kind::Session => {
                self.toolkit
                    .request(|response| ToolkitCommand::StopSession { response })
                    .await?;
            }
            Kind::Replay => {
                self.toolkit
                    .request(|response| ToolkitCommand::StopReplay { response })
                    .await?;
            }
        }
        self.finish_run();
        Ok(())
    }

    /// Moves from `Running` to `Finishing`, summarising the run.
    fn finish_run(&mut self) {
        let phase = std::mem::replace(&mut self.phase, Phase::Idle);
        let Phase::Running(run) = phase else {
            self.phase = phase;
            return;
        };
        let what = match run.kind {
            Kind::Session => "Session",
            Kind::Replay => "Replay",
        };
        let summary = format!(
            "{what} finished after {} with {} raw samples.",
            crate::output::format_duration(run.elapsed()),
            run.raw_samples()
        );
        self.log.info(summary.clone());
        self.last_run = vec![summary];
        for (mac_address, live) in &run.boards {
            let mut line = format!(
                "  {}: {} raw / {} processed samples",
                live.name, live.raw_samples, live.processed_samples
            );
            if let Some(si) = live.stability_index {
                line.push_str(&format!(", last SI {si:.2}"));
            }
            let _ = mac_address;
            self.last_run.push(line);
        }
        self.phase = Phase::Finishing {
            kind: run.kind,
            watch: run.watch,
            deadline: Instant::now() + RecordingWatch::TIMEOUT,
        };
    }

    // ------------------------------------------------------------------------------------
    // Replay tab
    // ------------------------------------------------------------------------------------

    async fn replay_key(&mut self, key: KeyEvent) -> Result<()> {
        match key.code {
            KeyCode::Up | KeyCode::Char('k') => {
                self.replay_cursor = self.replay_cursor.saturating_sub(1);
            }
            KeyCode::Down | KeyCode::Char('j') => {
                self.replay_cursor =
                    (self.replay_cursor + 1).min(self.recordings.len().saturating_sub(1));
            }
            KeyCode::Enter | KeyCode::Char('r') => self.start_replay().await?,
            KeyCode::Char('R') | KeyCode::F(5) => {
                self.reload_recordings();
                self.log.info("Recording list refreshed.");
            }
            KeyCode::Char('T') => self.core.tcp_enabled = !self.core.tcp_enabled,
            KeyCode::Char('L') => self.core.lsl_enabled = !self.core.lsl_enabled,
            _ => {}
        }
        Ok(())
    }

    pub fn reload_recordings(&mut self) {
        self.recordings = list_recordings(&self.settings.store_files_default_directory);
        self.replay_cursor = self
            .replay_cursor
            .min(self.recordings.len().saturating_sub(1));
    }

    async fn start_replay(&mut self) -> Result<()> {
        if self.is_running() {
            bail!("A run is already in progress.");
        }
        let recording = self
            .recordings
            .get(self.replay_cursor)
            .cloned()
            .context("No recording is selected.")?;
        let file = recording
            .path
            .canonicalize()
            .with_context(|| format!("Cannot open {}", recording.path.display()))?;
        self.toolkit
            .request(|response| ToolkitCommand::LoadReplayFile {
                file_path: file.clone(),
                response,
            })
            .await
            .context("Failed to load the session for replay (details in the log)")?;
        self.settings = self.toolkit.settings().await?;
        let info = self
            .toolkit
            .request(|response| ToolkitCommand::ReplayInformation { response })
            .await?
            .context("The session file did not load")?;
        // Streams and destination follow the dashboard; the analysis settings follow the
        // recording, as they do for `tbt replay run` without overrides.
        let mut core = info.core.clone();
        core.tcp_enabled = self.core.tcp_enabled;
        core.lsl_enabled = self.core.lsl_enabled;
        core.output_directory = if self.core.output_directory.as_os_str().is_empty() {
            self.settings.store_files_default_directory.clone()
        } else {
            self.core.output_directory.clone()
        };
        prepare_output_directory(&self.settings, &core.output_directory)?;
        self.toolkit
            .request(|response| ToolkitCommand::UpdateReplayInformation {
                configuration: core,
                response,
            })
            .await?;
        let info = self
            .toolkit
            .request(|response| ToolkitCommand::ReplayInformation { response })
            .await?
            .context("The session file did not load")?;
        let names: HashMap<MacAddress, String> = info
            .devices
            .iter()
            .map(|b| (b.mac_address, b.name.clone()))
            .collect();
        let watch = RecordingWatch::before(
            &self.settings,
            &info.core.output_directory,
            names.keys().copied(),
        );
        let (data_tx, data_rx) = mpsc::channel(2048);
        self.toolkit
            .request(|response| ToolkitCommand::StartReplay {
                frontend_channel: data_tx,
                response,
            })
            .await?;
        self.log.info(format!(
            "Replaying {} ({}). Press s to stop.",
            recording.file_name,
            crate::output::format_duration(recording.duration)
        ));
        self.phase = Phase::Running(Box::new(Run {
            kind: Kind::Replay,
            data_rx: Some(data_rx),
            started: Instant::now(),
            planned: Some(recording.duration),
            boards: BTreeMap::new(),
            names,
            activity: None,
            has_activity: false,
            stopping: false,
            watch,
            last_activity_poll: Instant::now(),
        }));
        self.tab = Tab::Session;
        Ok(())
    }

    // ------------------------------------------------------------------------------------
    // Settings tab
    // ------------------------------------------------------------------------------------

    async fn settings_key(&mut self, key: KeyEvent) -> Result<()> {
        match key.code {
            KeyCode::Up | KeyCode::Char('k') => {
                self.settings_cursor = self.settings_cursor.saturating_sub(1);
            }
            KeyCode::Down | KeyCode::Char('j') => {
                self.settings_cursor =
                    (self.settings_cursor + 1).min(self.settings_rows.len().saturating_sub(1));
            }
            KeyCode::Enter | KeyCode::Char(' ') => {
                let Some((key, value)) = self.settings_rows.get(self.settings_cursor).cloned()
                else {
                    return Ok(());
                };
                match value.as_str() {
                    "true" => self.save_setting(&key, "false").await?,
                    "false" => self.save_setting(&key, "true").await?,
                    _ => {
                        self.modal = Some(Modal::Prompt {
                            title: key.clone(),
                            value,
                            action: Action::SetSetting(key),
                        });
                    }
                }
            }
            _ => {}
        }
        Ok(())
    }

    async fn save_setting(&mut self, key: &str, raw: &str) -> Result<()> {
        if self.is_running() {
            bail!("Settings cannot change while a run is in progress.");
        }
        let updated = apply_setting(&self.settings, key, raw)?;
        let previous_directory = self.settings.store_files_default_directory.clone();
        self.toolkit
            .request(|response| ToolkitCommand::SaveSettings {
                settings: updated,
                response,
            })
            .await
            .context("The settings could not be saved (details in the log)")?;
        self.settings = self.toolkit.settings().await?;
        self.reload_settings_rows()?;
        if self.core.output_directory == previous_directory {
            self.core.output_directory = self.settings.store_files_default_directory.clone();
        }
        let shown = self
            .settings_rows
            .iter()
            .find(|(k, _)| k == key)
            .map(|(_, v)| v.clone())
            .unwrap_or_default();
        self.log.info(format!("{key} = {shown}"));
        if key == "isDemoMode" {
            self.selected.clear();
            self.refresh_boards().await?;
            self.reload_recordings();
        }
        Ok(())
    }

    fn reload_settings_rows(&mut self) -> Result<()> {
        self.settings_rows = flatten(&serde_json::to_value(&self.settings)?);
        self.settings_cursor = self
            .settings_cursor
            .min(self.settings_rows.len().saturating_sub(1));
        Ok(())
    }

    // ------------------------------------------------------------------------------------
    // Background progress
    // ------------------------------------------------------------------------------------

    /// Called on a short interval: advances connection attempts, enforces the duration,
    /// polls the activity state, checks for finalised files and refreshes the board list.
    pub async fn tick(&mut self) -> Result<()> {
        match &mut self.phase {
            Phase::Idle => {
                if self.last_board_refresh.elapsed() >= BOARD_REFRESH {
                    self.refresh_boards().await?;
                }
            }
            Phase::Connecting { .. } => self.connect_step().await?,
            Phase::Running(run) => {
                if run.kind == Kind::Session
                    && !run.stopping
                    && run.planned.is_some_and(|planned| run.elapsed() >= planned)
                {
                    self.stop_run().await?;
                } else if run.has_activity
                    && run.last_activity_poll.elapsed() >= Duration::from_millis(250)
                {
                    run.last_activity_poll = Instant::now();
                    run.activity = self
                        .toolkit
                        .request(|response| ToolkitCommand::SessionActivityState { response })
                        .await?;
                }
            }
            Phase::Finishing {
                kind,
                watch,
                deadline,
            } => {
                let kind = *kind;
                if !watch.enabled() {
                    self.log.info(
                        "Recording to disk is disabled in the settings; no files were written.",
                    );
                    self.after_finish(kind);
                } else if let Some((path, session)) = watch.finalised() {
                    for line in RecordingWatch::describe(&path, &session) {
                        self.log.info(line.clone());
                        self.last_run.push(line);
                    }
                    self.after_finish(kind);
                } else if Instant::now() >= *deadline {
                    let directory = watch.directory().display().to_string();
                    self.after_finish(kind);
                    bail!(
                        "The recording in {directory} was not finalised within {}s; its files may be incomplete.",
                        RecordingWatch::TIMEOUT.as_secs()
                    );
                }
            }
        }
        Ok(())
    }

    fn after_finish(&mut self, kind: Kind) {
        self.phase = Phase::Idle;
        if kind == Kind::Replay {
            // Otherwise a later `tbt session run` would inherit the replay's file.
            let commands = self.toolkit.commands.clone();
            tokio::spawn(async move {
                let _ = toolkit_core::request(&commands, |response| ToolkitCommand::ClearReplay {
                    response,
                })
                .await;
            });
        }
        self.reload_recordings();
        if self.quit_after_finish {
            self.should_quit = true;
        }
    }

    pub fn record(&mut self, sample: BalanceBoardOutput) {
        if let Phase::Running(run) = &mut self.phase {
            run.record(sample);
        }
    }

    /// The next sample of the current run, or a future that never resolves when there is no
    /// run or its channel has closed.
    pub async fn next_sample(phase: &mut Phase) -> BalanceBoardOutput {
        if let Phase::Running(run) = phase
            && let Some(data_rx) = run.data_rx.as_mut()
        {
            match data_rx.recv().await {
                Some(sample) => return sample,
                None => run.data_rx = None,
            }
        }
        std::future::pending().await
    }

    pub async fn handle_event(&mut self, event: ToolkitResponse) -> Result<()> {
        match event {
            ToolkitResponse::NewDeviceFound(mac_address) => {
                self.log.info(format!(
                    "Connected {}.",
                    mac_address_human_name(mac_address)
                ));
                self.refresh_boards().await?;
            }
            ToolkitResponse::SessionCompleted => {
                if matches!(&self.phase, Phase::Running(run) if run.kind == Kind::Session && !run.stopping)
                {
                    self.finish_run();
                }
            }
            ToolkitResponse::ReplayCompleted => {
                if matches!(&self.phase, Phase::Running(run) if run.kind == Kind::Replay && !run.stopping)
                {
                    self.finish_run();
                }
            }
            ToolkitResponse::SessionActivityChanged => {
                if let Phase::Running(run) = &mut self.phase
                    && run.has_activity
                {
                    run.activity = self
                        .toolkit
                        .request(|response| ToolkitCommand::SessionActivityState { response })
                        .await?;
                }
            }
            ToolkitResponse::SessionStarted => {}
        }
        Ok(())
    }
}

enum Input {
    Confirmed,
    Text(String),
    Choice(usize),
}

fn parse_number(text: &str, what: &str) -> Result<u64> {
    let value: u64 = text
        .trim()
        .parse()
        .with_context(|| format!("'{text}' is not a whole number for the {what}."))?;
    if value == 0 {
        bail!("The {what} must be greater than zero.");
    }
    Ok(value)
}

pub fn activity_duration(activity: &Activity) -> Duration {
    Duration::from_millis(activity.get_total_duration_ms().max(0) as u64)
}

/// Every `tbt-*.settings.json` in `directory`, newest first.
fn list_recordings(directory: &Path) -> Vec<Recording> {
    let Ok(entries) = std::fs::read_dir(directory) else {
        return Vec::new();
    };
    let mut recordings: Vec<Recording> = entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            let file_name = path.file_name()?.to_str()?.to_string();
            if !file_name.starts_with("tbt-") || !file_name.ends_with(".settings.json") {
                return None;
            }
            let session = ExistingSessionFileSystem::load(&path).ok()?;
            Some(Recording {
                path,
                file_name,
                user: session.user.name,
                boards: session.device_names.len(),
                duration: session.session_stats.duration,
                activity: session.activity.map(|a| a.title),
            })
        })
        .collect();
    recordings.sort_by(|a, b| b.file_name.cmp(&a.file_name));
    recordings
}
