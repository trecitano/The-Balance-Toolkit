<table border="0">
  <tr>
    <td width="150" valign="middle" align="center">
      <img src="apps/tauri/src/assets/logo/icon.svg" width="130" alt="The Balance Toolkit logo">
    </td>
    <td valign="middle">
      <h1>The Balance Toolkit</h1>
      <p><em>Source code for our CHI PLAY 2026 toolkit for repurposed Wii Balance Boards.</em></p>
    </td>
  </tr>
</table>

**[Install](INSTALL.md)** &middot; **[Desktop GUI](apps/tauri/)** &middot; **[Headless CLI](apps/cli/)** &middot; **[Android](apps/android/)** &middot; **[Rust core](crates/toolkit-core/)** &middot; **[Python scripts](scripts/)** &middot; **[Ready-to-run apps](https://github.com/trecitano/The-Balance-Toolkit-Apps)**

---

This repository holds the source code for **_The Balance Toolkit: Democratizing Balance-Based Interaction Through Open-Source Software for Repurposed Wii Balance Boards_** (CHI PLAY 2026). It contains the cross-platform desktop application, a headless command-line tool, the Android application, streaming tools, and platform support files used to reproduce and extend the system described in the paper.

The Balance Toolkit turns an inexpensive consumer Wii Balance Board (WBB) into a research and development platform for balance-based games, rehabilitation, and accessible play. It handles Bluetooth pairing, reads the four force sensors, computes center of pressure (CoP) and posturography metrics, records sessions, replays captured data, and streams live data to games and analysis tools over TCP and Lab Streaming Layer (LSL).

## Video walkthrough

<a href="https://youtu.be/_8UwrUgqUao">
  <img src="https://img.youtube.com/vi/_8UwrUgqUao/maxresdefault.jpg" width="640" alt="Watch The Balance Toolkit walkthrough on YouTube">
</a>

Watch the full walkthrough on [YouTube](https://youtu.be/_8UwrUgqUao).

## Repository layout

The Rust core is the heart of the toolkit; the desktop app and the headless CLI are two frontends for it. The Android app is a companion and standalone capture application. The Python scripts consume the streams emitted by either frontend for inspection and integration testing. Shippable applications live under `apps/`; shared libraries live under `crates/`.

| Folder | Contents | Guide |
|---|---|---|
| [`apps/tauri/`](apps/tauri/) | Desktop GUI app: React, TypeScript and Vite frontend in `src/`, Tauri shell in `src-tauri/` | [Install](INSTALL.md) |
| [`apps/cli/`](apps/cli/) | `tbt`, the headless command-line frontend (no window, no webview) | [Headless CLI](INSTALL.md#headless-cli-tbt) |
| [`apps/android/`](apps/android/) | Android application built with Kotlin and Jetpack Compose | [Read](apps/android/README.md) |
| [`crates/toolkit-core/`](crates/toolkit-core/) | Rust library for Bluetooth, board I/O, session state, processing, recording, replay, TCP, and LSL | [Install](INSTALL.md) |
| [`scripts/`](scripts/) | Python scripts for inspecting the LSL and TCP data streams | This README |
| [`apps/tauri/public/activities/`](apps/tauri/public/activities/) | Activity illustrations and toolkit artwork used by the desktop app | This README |
| [`linux/`](linux/) | Linux udev rules for Wii Balance Board HID access | [Install](INSTALL.md) |
| [`resources/`](resources/) | Research support files, including expert survey results | This README |

Packaged applications and integration examples are published separately in [The Balance Toolkit - Apps](https://github.com/trecitano/The-Balance-Toolkit-Apps).

## What the toolkit does

- **Cross-platform desktop app** for Windows, macOS, and Linux, built with Rust, Tauri, React, and TypeScript.
- **Headless CLI** (`tbt`) that pairs boards, records and replays sessions, and streams over TCP and LSL from a terminal or a server with no display. It shares settings, users and recordings with the desktop app.
- **Android companion app** for Bluetooth board connection, live sessions, user/device management, and standalone session capture.
- **Bluetooth connectivity** to Wii Balance Boards, including support for one or two boards in a session.
- **Data processing pipeline** that computes center of pressure, sway, spatial and stability metrics, and frequency analysis.
- **Real-time streaming** over TCP and LSL, so games and analysis tools can consume live raw and processed data.
- **Six posturography activity templates**: Eyes Open-Close, Functional Reach Test, Single Leg Stance, Tandem Stance, Timed Up and Go, and Squat.
- **Session recording and replay** with raw CSV files, processed CSV files, and session settings JSON.
- **Python stream inspection tools** for validating TCP and LSL output during development.

## Quick start

For development without a board or display, follow the
[verification quick start](docs/DEVELOPMENT.md#first-setup). `mise run verify`
checks the core, CLI and frontend and exercises isolated mock recording/replay.

1. Install the system dependencies in [`INSTALL.md`](INSTALL.md), including Bun, Rust, CMake, and the platform-specific Tauri prerequisites.
2. Install frontend dependencies from the desktop app directory.

```bash
cd apps/tauri
bun install
```

3. Run the desktop app in development mode, from `apps/tauri/`.

```bash
bun run tauri dev
```

4. Add a Wii Balance Board under the **Devices** menu, then add it to a session under the **Session** menu.
5. Toggle **TCP** or **LSL** streaming on, start recording, and consume the live stream from Python, Unity, or another client.

Prefer a terminal? Build the headless CLI instead and record with two commands:

```bash
cargo build --release -p toolkit-cli
./target/release/tbt devices scan       # press the board's SYNC button, Ctrl-C when paired
./target/release/tbt session run --tcp  # record every connected board until Ctrl-C
```

The Android app in [`apps/android/`](apps/android/) can be opened directly in Android Studio. See [`apps/android/README.md`](apps/android/README.md) for Android setup, build, and validation commands.

## Development commands

Run these from the repository root unless noted otherwise.

Use [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the full workflow and pass criteria:

```bash
mise run doctor
mise run verify
```

The commands below are also available individually. Run them through
`mise exec --` if your shell does not activate the pinned tools.

```bash
# desktop app (run from apps/tauri/)
bun run lint          # frontend lint
bun run build         # frontend build
bun run tauri dev     # development server
bun run tauri build   # production bundle

# Rust workspace compile check (core, desktop shell and CLI)
cargo check --workspace

# headless CLI
cargo run -p toolkit-cli -- --help
cargo build --release -p toolkit-cli
```

Android command-line builds are run from [`apps/android/`](apps/android/):

```bash
./gradlew :app:assembleDebug
./gradlew lintKotlin detekt :app:assembleDebug
```

## Data stream reference

Both Rust frontends expose raw and processed streams. Raw acquisition targets
about 100 Hz; processed results follow `windowSlideMs` (100 ms by default, about
10 results/second). `samplingRate` controls interpolation within the processing
window. LSL currently advertises a hardcoded nominal 100 Hz for both streams,
which does not describe the processed publication cadence. By default, TCP binds
to `localhost:11223` for raw data and `localhost:11224` for processed data. LSL uses
the default stream name `the-balance-toolkit` and publishes two suffixed streams:

- **`the-balance-toolkit_basic`** (8 channels): `timestamp`, `mac_address`, `top_right`, `bottom_right`, `top_left`, `bottom_left`, `cop_x`, `cop_y`.
- **`the-balance-toolkit_complex`** (9 channels): `timestamp`, `mac_address`, `v_cop_x`, `v_cop_y`, `stability_index`, `dpsi_mlsi`, `dpsi_apsi`, `dpsi_vsi`, `dpsi_overall`.

Force values are in kilograms. Timestamps are in microseconds. Raw CoP values are normalized to roughly -1 to +1. Processed metrics are computed from the CoP scaled to millimetres using the board dimensions in the processing settings: velocities are in mm/s, and the stability index, `dpsi_mlsi` and `dpsi_apsi` are in mm. `dpsi_vsi` is the RMS load deviation as a fraction of the baseline weight, and `dpsi_overall` pools the three terms.

Session output is written to the configured session directory as:

- raw CSV files: `*-raw.csv`
- processed CSV files: `*-processed.csv`
- session metadata and settings: `*.settings.json`

## Citation

If you use The Balance Toolkit in your research, please cite our paper.

**APA**

> Valente, A., Kothari, N., Ahmed-Mahmoud, H., Esteves, A., & Billinghurst, M. (2026). The Balance Toolkit: Democratizing balance-based interaction through open-source software for repurposed Wii Balance Boards. In *Proceedings of the Annual Symposium on Computer-Human Interaction in Play (CHI PLAY '26)*. ACM.

**BibTeX**

```bibtex
@inproceedings{valente2026balancetoolkit,
  title     = {The Balance Toolkit: Democratizing Balance-Based Interaction
               Through Open-Source Software for Repurposed Wii Balance Boards},
  author    = {Valente, Andreia and Kothari, Nidhi and Ahmed-Mahmoud, Hana
               and Esteves, Augusto and Billinghurst, Mark},
  booktitle = {Annual Symposium on Computer-Human Interaction in Play (CHI PLAY '26)},
  year      = {2026},
  address   = {York, UK},
  publisher = {ACM}
}
```

DOI to be added on publication.

## License

The Rust crates declare an MIT license. See the paper and repository licensing terms before redistributing applications or research materials.

---

<sub>The Balance Toolkit &middot; The Empathic Computing Laboratory, Auckland Bioengineering Institute, University of Auckland</sub>
