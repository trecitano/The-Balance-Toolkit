# `tbt`: The Balance Toolkit, headless

A terminal frontend for [The Balance Toolkit](../../README.md). It runs the same
Rust core as the desktop app (`toolkit-core`) without a window or a webview, so
it works over SSH, on a capture machine without a display, or in a script.

Settings, users, activities, the list of paired boards and the recordings are
shared with the desktop app: pair a board here and it appears there, and the
other way round.

## Build

```bash
mise exec -- cargo build --locked --release -p toolkit-cli   # -> target/release/tbt
mise exec -- cargo run --locked -p toolkit-cli -- --help     # or run from source
```

System requirements are in [INSTALL.md](../../INSTALL.md#headless-cli-tbt).

## Interactive dashboard

`tbt` on its own (or `tbt tui`) opens a full-screen dashboard over the same core.
It has four tabs, switched with `1`-`4`, `Tab` or the arrow keys:

| Tab | What it does |
|---|---|
| Boards | Paired boards and their status. `s` scans for new boards, `Space` picks boards for the session, `i` blinks, `t` tares, `n` renames, `f` forgets |
| Session | The next recording: user, activity, duration, tare, TCP/LSL streams, output directory and analysis settings. `r` records; while recording, each board shows its weight, centre of pressure with a trail, stability index and DPSI |
| Replay | Recordings in the session directory. `Enter` replays one through the processing pipeline and the streams; `T`/`L` toggle them |
| Settings | Every shared setting. `Enter` toggles a switch or edits a value, saved for the desktop app too |

`?` shows the keys, `s` or `Esc` stops a running session or replay, `q` quits.
The core's log messages appear in the pane at the bottom instead of stderr;
`--log-level` and `TBT_LOG` still choose how much is shown. The dashboard needs a
terminal: in scripts, use the commands below.

## Commands

| Command | What it does |
|---|---|
| `tbt tui` | The interactive dashboard described above (also the default without a command) |
| `tbt devices list` | Known boards and whether each is connected now |
| `tbt devices scan [--timeout S]` | Pair boards (press the SYNC button); Ctrl-C to stop |
| `tbt devices rename BOARD NAME` | Name a board; names appear in file names and the desktop app |
| `tbt devices identify BOARD` | Blink a board's LED |
| `tbt devices tare BOARD` | Zero a board's sensors |
| `tbt devices forget BOARD` | Remove a board's pairing |
| `tbt session run [BOARD]... [options]` | Record until Ctrl-C, `--duration S`, or the end of `--activity ID` |
| `tbt session show` | The configuration the next run would use |
| `tbt session last` | The most recent recording |
| `tbt replay run SETTINGS_FILE [options]` | Replay a recording through processing and the streams |
| `tbt settings show` / `set KEY VALUE` / `path` | Shared toolkit settings and where they live |
| `tbt users list`, `tbt activities list`, `tbt activities show ID` | Reference data for `session run` |

`BOARD` is a board name or MAC address (`aa:bb:cc:dd:ee:ff`); a unique prefix of
either works. Global flags: `--json` for machine-readable output on list/show
commands, `--log-level LEVEL` (or `TBT_LOG`) for the core's logs on stderr.

### Session and replay options

| Flag | Meaning |
|---|---|
| `--tcp`, `--lsl` | Stream raw and processed data; addresses and names come from the settings |
| `--output DIR` | Where the CSV and settings files go (default: the settings' session directory) |
| `--user ID\|NAME`, `--activity ID` | Who the session is for and which activity template to follow |
| `--tare` | Zero the boards right before recording |
| `--live status\|samples\|none` | A refreshing status line (default), JSON Lines of every sample on stdout, or nothing |
| `--window-size-ms`, `--window-slide-ms`, `--sampling-rate`, `--interpolation` | Processing parameters for this run |

Progress and the status line go to stderr, so `--live samples` can be piped:

```bash
tbt session run --duration 30 --live samples | jq -c 'select(.event == "raw") | [.macAddress, .weightKg, .copX, .copY]'
```

## Without hardware

Run `mise run smoke` from the repository root to verify mock recording and replay
in temporary application directories. It checks completed files and failure exit
codes, then removes the test data. See [development verification](../../docs/DEVELOPMENT.md).

`tbt settings set isDemoMode true` switches the toolkit (desktop app included)
to simulated boards. `tbt devices list` then shows a few fake boards and
`tbt session run --duration 5` records synthetic data. Set it back to `false`
for real boards.

Recording and replay return nonzero if the output has not finalized within
10 seconds after stopping. A recording with disk output disabled does not create
files. Replay follows the same recording settings and can write a new recording;
use `--output` to select a separate destination.

## Data location

`the-balance-toolkit` inside your documents folder, or your home directory on
systems without one. `TBT_APP_DIR` overrides it; `tbt settings path` prints the
paths in use.
