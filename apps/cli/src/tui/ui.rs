//! Drawing the dashboard from the `App` state. Nothing here changes state.

use ratatui::Frame;
use ratatui::layout::{Alignment, Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style, Stylize};
use ratatui::symbols::Marker;
use ratatui::text::{Line, Span, Text};
use ratatui::widgets::canvas::{Canvas, Points, Rectangle};
use ratatui::widgets::{
    Block, Cell, Clear, Gauge, List, ListItem, ListState, Paragraph, Row, Sparkline, Table,
    TableState, Tabs, Wrap,
};
use std::time::Duration;
use toolkit_core::utils::mac_address_human_name;

use crate::commands::session::Kind;
use crate::output::{format_clock, format_duration, yes_no};
use crate::tui::app::{App, BoardLive, Modal, Phase, Run, SessionField, Tab, activity_duration};
use crate::tui::logger::Severity;

const ACCENT: Color = Color::Cyan;
const DIM: Color = Color::DarkGray;

pub fn draw(frame: &mut Frame, app: &App) {
    let [header, body, log, footer] = Layout::vertical([
        Constraint::Length(1),
        Constraint::Min(8),
        Constraint::Length(7),
        Constraint::Length(1),
    ])
    .areas(frame.area());

    draw_header(frame, app, header);
    match &app.phase {
        Phase::Running(run) if app.tab == Tab::Session => draw_live(frame, run, body),
        _ => match app.tab {
            Tab::Boards => draw_boards(frame, app, body),
            Tab::Session => draw_session(frame, app, body),
            Tab::Replay => draw_replay(frame, app, body),
            Tab::Settings => draw_settings(frame, app, body),
        },
    }
    draw_log(frame, app, log);
    draw_footer(frame, app, footer);
    if let Some(modal) = &app.modal {
        draw_modal(frame, modal, frame.area());
    }
}

fn draw_header(frame: &mut Frame, app: &App, area: Rect) {
    let [tabs_area, status_area] =
        Layout::horizontal([Constraint::Min(40), Constraint::Length(44)]).areas(area);
    let titles: Vec<Line> = Tab::ALL
        .iter()
        .map(|tab| Line::from(format!(" {} {} ", tab.index() + 1, tab.title())))
        .collect();
    let tabs = Tabs::new(titles)
        .select(app.tab.index())
        .highlight_style(Style::new().fg(Color::Black).bg(ACCENT).bold())
        .divider("");
    frame.render_widget(tabs, tabs_area);

    let mut status: Vec<Span> = Vec::new();
    if app.settings.is_demo_mode {
        status.push(" DEMO ".black().on_yellow().bold());
        status.push(" ".into());
    }
    if app.scanning {
        status.push(" SCANNING ".black().on_magenta().bold());
        status.push(" ".into());
    }
    match &app.phase {
        Phase::Idle => status.push("idle".fg(DIM)),
        Phase::Connecting { .. } => status.push("connecting…".yellow()),
        Phase::Running(run) => {
            let label = match run.kind {
                Kind::Session => "● REC",
                Kind::Replay => "▶ REPLAY",
            };
            status.push(
                format!(" {label} {} ", format_clock(run.elapsed()))
                    .white()
                    .on_red()
                    .bold(),
            );
        }
        Phase::Finishing { .. } => status.push("saving…".yellow()),
    }
    frame.render_widget(
        Paragraph::new(Line::from(status)).alignment(Alignment::Right),
        status_area,
    );
}

fn draw_boards(frame: &mut Frame, app: &App, area: Rect) {
    let title = if app.scanning {
        " Boards (scanning: press SYNC on the board) "
    } else {
        " Boards "
    };
    let block = Block::bordered().title(title);
    if app.boards.is_empty() {
        let text = Text::from(vec![
            Line::from("No boards known yet."),
            Line::from(""),
            Line::from(
                "Press s to scan, then press the red SYNC button inside the board's battery compartment.",
            ),
        ]);
        frame.render_widget(
            Paragraph::new(text).block(block).wrap(Wrap { trim: false }),
            area,
        );
        return;
    }

    let rows: Vec<Row> = app
        .boards
        .iter()
        .map(|board| {
            let selected = app.selected.contains(&board.mac_address);
            let status = if board.is_connected {
                "connected".green()
            } else {
                "offline".fg(DIM)
            };
            Row::new(vec![
                Cell::from(if selected {
                    "✓".yellow().bold()
                } else {
                    " ".into()
                }),
                Cell::from(board.name.clone()),
                Cell::from(mac_address_human_name(board.mac_address)),
                Cell::from(status),
                Cell::from(
                    board
                        .last_connected
                        .map(|t| t.format("%Y-%m-%d %H:%M UTC").to_string())
                        .unwrap_or_else(|| "-".to_string()),
                ),
            ])
        })
        .collect();
    let widths = [
        Constraint::Length(3),
        Constraint::Min(16),
        Constraint::Length(17),
        Constraint::Length(10),
        Constraint::Length(20),
    ];
    let footer = format!(
        " {} of {} selected for the session; Space toggles ",
        app.selected.len(),
        app.boards.len()
    );
    let table = Table::new(rows, widths)
        .header(header_row(&[
            "",
            "NAME",
            "MAC ADDRESS",
            "STATUS",
            "LAST SEEN",
        ]))
        .block(block.title_bottom(Line::from(footer).fg(DIM)))
        .row_highlight_style(Style::new().add_modifier(Modifier::REVERSED))
        .highlight_symbol("▶ ");
    let mut state = TableState::default().with_selected(app.board_cursor);
    frame.render_stateful_widget(table, area, &mut state);
}

fn draw_session(frame: &mut Frame, app: &App, area: Rect) {
    let [left, right] =
        Layout::horizontal([Constraint::Percentage(55), Constraint::Percentage(45)]).areas(area);

    let rows: Vec<Row> = SessionField::ALL
        .iter()
        .map(|field| {
            let value = session_value(app, *field);
            Row::new(vec![
                Cell::from(field.label().fg(ACCENT)),
                Cell::from(value),
            ])
        })
        .collect();
    let widths = [Constraint::Length(15), Constraint::Min(20)];
    let title = match &app.phase {
        Phase::Idle => " Session (r starts recording) ",
        Phase::Connecting { .. } => " Session (connecting to the boards…) ",
        Phase::Finishing { .. } => " Session (finalising the recording…) ",
        Phase::Running(_) => " Session ",
    };
    let table = Table::new(rows, widths)
        .block(Block::bordered().title(title))
        .row_highlight_style(Style::new().add_modifier(Modifier::REVERSED))
        .highlight_symbol("▶ ");
    let mut state = TableState::default().with_selected(app.session_cursor);
    frame.render_stateful_widget(table, left, &mut state);

    let mut lines: Vec<Line> = Vec::new();
    if let Some(activity) = app.activity() {
        lines.push(Line::from(vec![
            "Activity: ".fg(DIM),
            activity.title.clone().bold(),
        ]));
        if !activity.description.is_empty() {
            lines.push(Line::from(activity.description.clone()));
        }
        lines.push(Line::from(format!(
            "{} board(s), {} loop(s), {} in total",
            activity.boards_required,
            activity.loops,
            format_duration(activity_duration(activity))
        )));
        for (index, block) in activity.timeline_blocks.iter().enumerate() {
            lines.push(Line::from(format!(
                "  {}. {} ({}s)",
                index + 1,
                block.title,
                block.duration
            )));
        }
        lines.push(Line::from(""));
    }
    let store = app.settings.store_raw_session || app.settings.store_processed_data;
    lines.push(Line::from(vec![
        "Files: ".fg(DIM),
        if store {
            format!(
                "raw {}, processed {}",
                yes_no(app.settings.store_raw_session),
                yes_no(app.settings.store_processed_data)
            )
            .into()
        } else {
            "disabled in the settings".yellow()
        },
    ]));
    if app.core.tcp_enabled {
        lines.push(Line::from(format!(
            "TCP: raw {}, processed {}",
            app.settings.tcp_connection_string_raw, app.settings.tcp_connection_string_processed
        )));
    }
    if app.core.lsl_enabled {
        lines.push(Line::from(format!(
            "LSL: stream '{}'",
            app.settings.lsl_stream_name
        )));
    }
    if !app.last_run.is_empty() {
        lines.push(Line::from(""));
        lines.push(Line::from("Last run".fg(DIM)));
        for line in &app.last_run {
            lines.push(Line::from(line.clone()));
        }
    }
    frame.render_widget(
        Paragraph::new(Text::from(lines))
            .block(Block::bordered().title(" Details "))
            .wrap(Wrap { trim: false }),
        right,
    );
}

fn session_value(app: &App, field: SessionField) -> Line<'static> {
    let on_off = |value: bool| -> Line<'static> {
        if value {
            "on".green().into()
        } else {
            "off".fg(DIM).into()
        }
    };
    match field {
        SessionField::Boards => {
            let boards = app.selected_boards();
            if boards.is_empty() {
                let connected = app.boards.iter().filter(|b| b.is_connected).count();
                format!("every connected board ({connected})")
                    .fg(DIM)
                    .into()
            } else {
                boards
                    .iter()
                    .map(|b| b.name.as_str())
                    .collect::<Vec<_>>()
                    .join(", ")
                    .into()
            }
        }
        SessionField::User => app.user_label().into(),
        SessionField::Activity => match app.activity() {
            Some(activity) => activity.title.clone().into(),
            None => "none".fg(DIM).into(),
        },
        SessionField::Duration => {
            if app.core.activity_id.is_some() {
                "set by the activity".fg(DIM).into()
            } else {
                match app.duration_secs {
                    Some(seconds) => format_duration(Duration::from_secs(seconds)).into(),
                    None => "until stopped".fg(DIM).into(),
                }
            }
        }
        SessionField::TareFirst => on_off(app.tare_first),
        SessionField::Tcp => on_off(app.core.tcp_enabled),
        SessionField::Lsl => on_off(app.core.lsl_enabled),
        SessionField::Output => app.core.output_directory.display().to_string().into(),
        SessionField::WindowSize => format!("{} ms", app.core.window_size_ms).into(),
        SessionField::WindowSlide => format!("{} ms", app.core.window_slide_ms).into(),
        SessionField::SamplingRate => format!("{} Hz", app.core.sampling_rate).into(),
        SessionField::Interpolation => format!("{:?}", app.core.interpolation).into(),
    }
}

fn draw_live(frame: &mut Frame, run: &Run, area: Rect) {
    let [top, boards_area] =
        Layout::vertical([Constraint::Length(3), Constraint::Min(8)]).areas(area);

    // Progress: the activity block, the planned duration, or just the clock.
    let elapsed = run.elapsed();
    let (label, ratio) = match &run.activity {
        Some(state) => {
            let ongoing = state.ongoing_state.as_ref();
            let block = ongoing.and_then(|o| {
                state
                    .activity
                    .timeline_blocks
                    .get(o.current_block_index.max(0) as usize)
            });
            match (ongoing, block) {
                (Some(ongoing), Some(block)) => {
                    let left = (ongoing.time_to_next_block_ms.max(0) as f64 / 1000.0).ceil();
                    let total = block.duration.max(1) as f64;
                    (
                        format!(
                            "{}  {}  {} ({}s left, loop {}/{})",
                            format_clock(elapsed),
                            state.activity.title,
                            block.title,
                            left as i64,
                            ongoing.loop_number + 1,
                            state.activity.loops
                        ),
                        (1.0 - left / total).clamp(0.0, 1.0),
                    )
                }
                _ => (
                    format!("{}  {}", format_clock(elapsed), state.activity.title),
                    0.0,
                ),
            }
        }
        None => match run.planned {
            Some(planned) => (
                format!("{} / {}", format_clock(elapsed), format_clock(planned)),
                (elapsed.as_secs_f64() / planned.as_secs_f64().max(0.001)).clamp(0.0, 1.0),
            ),
            None => (format!("{}  (s stops)", format_clock(elapsed)), 0.0),
        },
    };
    let title = match run.kind {
        Kind::Session => " Recording ",
        Kind::Replay => " Replay ",
    };
    frame.render_widget(
        Gauge::default()
            .block(Block::bordered().title(title))
            .gauge_style(Style::new().fg(Color::Red).bg(Color::Black))
            .ratio(ratio)
            .label(label),
        top,
    );

    if run.boards.is_empty() {
        frame.render_widget(
            Paragraph::new("Waiting for the first samples…")
                .block(Block::bordered())
                .alignment(Alignment::Center),
            boards_area,
        );
        return;
    }
    let constraints = vec![Constraint::Ratio(1, run.boards.len() as u32); run.boards.len()];
    let columns = Layout::horizontal(constraints).split(boards_area);
    for (live, column) in run.boards.values().zip(columns.iter()) {
        draw_board_live(frame, live, *column);
    }
}

fn draw_board_live(frame: &mut Frame, live: &BoardLive, area: Rect) {
    let block = Block::bordered().title(format!(" {} ", live.name));
    let inner = block.inner(area);
    frame.render_widget(block, area);
    let [gauge, canvas, metrics, sparkline] = Layout::vertical([
        Constraint::Length(1),
        Constraint::Min(6),
        Constraint::Length(3),
        Constraint::Length(3),
    ])
    .areas(inner);

    // Weight, relative to the heaviest reading so far.
    let ratio = if live.max_weight_kg > 0.0 {
        (live.weight_kg / live.max_weight_kg).clamp(0.0, 1.0) as f64
    } else {
        0.0
    };
    frame.render_widget(
        Gauge::default()
            .gauge_style(Style::new().fg(ACCENT).bg(Color::Black))
            .ratio(ratio)
            .label(format!("{:.1} kg", live.weight_kg)),
        gauge,
    );

    // Centre of pressure on the board outline; the trail fades behind the live marker.
    let trail: Vec<(f64, f64)> = live.trail.iter().copied().collect();
    let (x, y) = (live.cop.0 as f64, live.cop.1 as f64);
    frame.render_widget(
        Canvas::default()
            .marker(Marker::Braille)
            .x_bounds([-1.15, 1.15])
            .y_bounds([-1.15, 1.15])
            .paint(move |ctx| {
                ctx.draw(&Rectangle {
                    x: -1.0,
                    y: -1.0,
                    width: 2.0,
                    height: 2.0,
                    color: DIM,
                });
                ctx.draw(&Points {
                    coords: &[(0.0, 0.0)],
                    color: DIM,
                });
                ctx.draw(&Points {
                    coords: &trail,
                    color: Color::Blue,
                });
                ctx.layer();
                ctx.print(x, y, "◉".yellow().bold());
            }),
        canvas,
    );

    let optional = |value: Option<f32>| -> String {
        value
            .map(|v| format!("{v:.2}"))
            .unwrap_or_else(|| "-".into())
    };
    let text = Text::from(vec![
        Line::from(format!("CoP ({:+.2}, {:+.2})", live.cop.0, live.cop.1)),
        Line::from(format!(
            "SI {}   DPSI {}   v {}",
            optional(live.stability_index),
            optional(live.dpsi),
            optional(live.mean_velocity)
        )),
        Line::from(
            format!(
                "{} raw / {} processed",
                live.raw_samples, live.processed_samples
            )
            .fg(DIM),
        ),
    ]);
    frame.render_widget(Paragraph::new(text), metrics);

    let history: Vec<u64> = live.weight_history.iter().copied().collect();
    frame.render_widget(
        Sparkline::default()
            .block(Block::new().title("weight".fg(DIM)))
            .style(Style::new().fg(ACCENT))
            .data(history),
        sparkline,
    );
}

fn draw_replay(frame: &mut Frame, app: &App, area: Rect) {
    let title = format!(
        " Recordings in {} ",
        app.settings.store_files_default_directory.display()
    );
    let block = Block::bordered().title(title);
    if app.recordings.is_empty() {
        frame.render_widget(
            Paragraph::new("No recordings yet. Record one on the Session tab.")
                .block(block)
                .wrap(Wrap { trim: false }),
            area,
        );
        return;
    }
    let rows: Vec<Row> = app
        .recordings
        .iter()
        .map(|recording| {
            Row::new(vec![
                Cell::from(recording.file_name.clone()),
                Cell::from(recording.user.clone()),
                Cell::from(recording.boards.to_string()),
                Cell::from(format_duration(recording.duration)),
                Cell::from(recording.activity.clone().unwrap_or_else(|| "-".into())),
            ])
        })
        .collect();
    let widths = [
        Constraint::Length(34),
        Constraint::Min(12),
        Constraint::Length(6),
        Constraint::Length(10),
        Constraint::Min(10),
    ];
    let footer = format!(
        " streams: TCP {} (T)  LSL {} (L)  output {} ",
        yes_no(app.core.tcp_enabled),
        yes_no(app.core.lsl_enabled),
        app.core.output_directory.display()
    );
    let table = Table::new(rows, widths)
        .header(header_row(&[
            "FILE", "USER", "BOARDS", "DURATION", "ACTIVITY",
        ]))
        .block(block.title_bottom(Line::from(footer).fg(DIM)))
        .row_highlight_style(Style::new().add_modifier(Modifier::REVERSED))
        .highlight_symbol("▶ ");
    let mut state = TableState::default().with_selected(app.replay_cursor);
    frame.render_stateful_widget(table, area, &mut state);
}

fn draw_settings(frame: &mut Frame, app: &App, area: Rect) {
    let rows: Vec<Row> = app
        .settings_rows
        .iter()
        .map(|(key, value)| {
            let value: Span = match value.as_str() {
                "true" => "true".green(),
                "false" => "false".fg(DIM),
                other => other.to_string().into(),
            };
            Row::new(vec![Cell::from(key.clone().fg(ACCENT)), Cell::from(value)])
        })
        .collect();
    let widths = [Constraint::Length(44), Constraint::Min(20)];
    let table = Table::new(rows, widths)
        .header(header_row(&["SETTING", "VALUE"]))
        .block(
            Block::bordered()
                .title(" Settings (shared with the desktop app) ")
                .title_bottom(Line::from(" Enter toggles a switch or edits a value ").fg(DIM)),
        )
        .row_highlight_style(Style::new().add_modifier(Modifier::REVERSED))
        .highlight_symbol("▶ ");
    let mut state = TableState::default().with_selected(app.settings_cursor);
    frame.render_stateful_widget(table, area, &mut state);
}

fn draw_log(frame: &mut Frame, app: &App, area: Rect) {
    let visible = area.height.saturating_sub(2) as usize;
    let lines: Vec<Line> = app
        .log
        .tail(visible)
        .into_iter()
        .map(|entry| {
            let text = match entry.severity {
                Severity::Info => Span::from(entry.text),
                Severity::Warn => entry.text.yellow(),
                Severity::Error => entry.text.red(),
            };
            Line::from(vec![format!("{} ", format_clock(entry.at)).fg(DIM), text])
        })
        .collect();
    frame.render_widget(
        Paragraph::new(Text::from(lines)).block(Block::bordered().title(" Messages ")),
        area,
    );
}

fn draw_footer(frame: &mut Frame, app: &App, area: Rect) {
    let hints: &[(&str, &str)] = if app.modal.is_some() {
        &[("Enter", "confirm"), ("Esc", "cancel")]
    } else if matches!(app.phase, Phase::Running(_)) {
        &[
            ("s", "stop"),
            ("Tab", "switch tab"),
            ("?", "help"),
            ("q", "quit"),
        ]
    } else {
        match app.tab {
            Tab::Boards => &[
                ("Space", "select"),
                ("s", "scan"),
                ("i", "identify"),
                ("t", "tare"),
                ("n", "rename"),
                ("f", "forget"),
                ("r", "refresh"),
                ("?", "help"),
                ("q", "quit"),
            ],
            Tab::Session => &[
                ("↑↓", "move"),
                ("Enter", "edit"),
                ("r", "record"),
                ("?", "help"),
                ("q", "quit"),
            ],
            Tab::Replay => &[
                ("↑↓", "move"),
                ("Enter", "replay"),
                ("T/L", "streams"),
                ("R", "refresh"),
                ("?", "help"),
                ("q", "quit"),
            ],
            Tab::Settings => &[
                ("↑↓", "move"),
                ("Enter", "edit"),
                ("?", "help"),
                ("q", "quit"),
            ],
        }
    };
    let mut spans: Vec<Span> = Vec::new();
    for (key, what) in hints {
        spans.push(format!(" {key} ").black().on_white());
        spans.push(format!(" {what}  ").into());
    }
    frame.render_widget(Paragraph::new(Line::from(spans)), area);
}

fn draw_modal(frame: &mut Frame, modal: &Modal, area: Rect) {
    match modal {
        Modal::Help => {
            let text = Text::from(vec![
                Line::from("Everywhere".bold()),
                Line::from("  1-4, Tab, ←→   switch tab          q, Ctrl-C   quit"),
                Line::from("  ↑↓ or j/k      move                ?           this help"),
                Line::from(""),
                Line::from("Boards".bold()),
                Line::from("  Space   select or unselect a board for the session"),
                Line::from("  s       start or stop pairing (press the board's SYNC button)"),
                Line::from("  i       blink the board's LED      t   tare the board"),
                Line::from("  n       rename                     f   forget the pairing"),
                Line::from(""),
                Line::from("Session".bold()),
                Line::from("  Enter   edit the highlighted row    r   start recording"),
                Line::from("  s/Esc   stop the recording or replay"),
                Line::from(""),
                Line::from("Replay".bold()),
                Line::from("  Enter   replay the highlighted recording through the streams"),
                Line::from("  T / L   toggle the TCP / LSL streams"),
                Line::from(""),
                Line::from("Settings".bold()),
                Line::from(
                    "  Enter   toggle a switch or edit a value (saved for the desktop app too)",
                ),
            ]);
            let rect = centered(area, 76, text.height() as u16 + 2);
            frame.render_widget(Clear, rect);
            frame.render_widget(
                Paragraph::new(text).block(Block::bordered().title(" Help ")),
                rect,
            );
        }
        Modal::Confirm { title, text, .. } => {
            let body = Text::from(vec![
                Line::from(text.clone()),
                Line::from(""),
                Line::from(vec![
                    "y".bold(),
                    " yes    ".into(),
                    "n".bold(),
                    " no".into(),
                ]),
            ]);
            let rect = centered(area, 60, 5);
            frame.render_widget(Clear, rect);
            frame.render_widget(
                Paragraph::new(body)
                    .block(Block::bordered().title(format!(" {title} ")))
                    .wrap(Wrap { trim: false }),
                rect,
            );
        }
        Modal::Prompt { title, value, .. } => {
            let rect = centered(area, 70, 3);
            frame.render_widget(Clear, rect);
            frame.render_widget(
                Paragraph::new(Line::from(vec![value.clone().into(), "█".fg(ACCENT)]))
                    .block(Block::bordered().title(format!(" {title} "))),
                rect,
            );
        }
        Modal::Picker {
            title,
            items,
            cursor,
            ..
        } => {
            let height = (items.len() as u16 + 2).min(area.height.saturating_sub(4));
            let rect = centered(area, 60, height);
            frame.render_widget(Clear, rect);
            let list = List::new(items.iter().map(|item| ListItem::new(item.clone())))
                .block(Block::bordered().title(format!(" {title} ")))
                .highlight_style(Style::new().add_modifier(Modifier::REVERSED))
                .highlight_symbol("▶ ");
            let mut state = ListState::default().with_selected(Some(*cursor));
            frame.render_stateful_widget(list, rect, &mut state);
        }
    }
}

fn header_row(titles: &[&'static str]) -> Row<'static> {
    Row::new(titles.iter().map(|t| Cell::from((*t).fg(DIM).bold())))
}

fn centered(area: Rect, width: u16, height: u16) -> Rect {
    let width = width.min(area.width);
    let height = height.min(area.height);
    Rect {
        x: area.x + (area.width - width) / 2,
        y: area.y + (area.height - height) / 2,
        width,
        height,
    }
}
