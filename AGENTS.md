# Working on The Balance Toolkit

## Start here

Read [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for setup and verification.
Use `mise run …` or `mise exec -- …` so commands use the versions in
`mise.toml`. A system `cargo` may use a different Rust version.

## Ownership and boundaries

| Path | Responsibility |
|---|---|
| `crates/toolkit-core/` | Bluetooth, HID, processing, session state, persistence, recording and replay |
| `apps/cli/` | `tbt` arguments, terminal output, orchestration and process exit status |
| `apps/tauri/src-tauri/` | Desktop shell, Tauri commands, typed events and the desktop wire types (`src/frontend/dto.rs`) |
| `apps/tauri/src/` | React UI, queries, frame storage and plots |
| `apps/android/` | Separate Kotlin application; also read `apps/android/AGENTS.md` |
| `tests/fixtures/` | Synthetic sensor cases shared with Android and desktop recording examples |
| `scripts/verify/` | Development diagnostics |

The desktop shell and CLI share the Rust core. Android does not use that core.
Keep UI/toolkit boundaries explicit. `toolkit-core` knows nothing about Tauri or
`specta`: the desktop shell mirrors every type that crosses the bridge in
`apps/tauri/src-tauri/src/frontend/dto.rs` with `From` conversions, and commands
only take and return those DTOs. The TypeScript command, event and payload types
in `apps/tauri/src/bindings.ts` are generated from the DTOs by `tauri-specta`;
never edit that file. After changing a Tauri command, an event or a DTO, run
`mise run gen:bindings` and commit the result (`mise run check:desktop` fails
while the file is stale). `apps/tauri/src/types.ts` only aliases generated names
and holds UI-only shapes.

## Verification

Run from the repository root. All commands below are noninteractive.

| Change | Checks |
|---|---|
| Rust math, types or persistence | `mise run check:rust` and `mise run test` |
| CLI, recording or replay | Above, plus `mise run smoke` |
| React/TypeScript | `mise run check:frontend` |
| Tauri bridge | `mise run gen:bindings`, then `mise run check:rust`, `mise run check:desktop`, `mise run check:frontend` |
| Shared sensor fixtures | `mise run test` and `mise run test:android` |
| Android | `mise run test:android` and `mise run check:android` |
| Full default verification profile | `mise run verify` |

To check a change in the running desktop UI (click through pages, read the DOM,
screenshot), drive the app over WebDriver with `tauri-driver`; see
[Driving the desktop UI with WebDriver](docs/DEVELOPMENT.md#driving-the-desktop-ui-with-webdriver).

`verify` covers the core, CLI and frontend without a board, display or Bluetooth
service. The Tauri shell and Android have separate checks with native SDK
prerequisites. A passing build is not evidence of physical Bluetooth behavior.
Frontend lint currently reports existing warnings; it is not a zero-warning gate.

## Data and behavior invariants

- Run experiments in a fresh `TBT_APP_DIR`. `mise run smoke` creates and cleans
  isolated temporary directories automatically. Demo settings persist and are
  shared with the desktop app when the application directory is shared.
- Sensor order in the shared fixtures and raw CSV is top-right, bottom-right,
  top-left, bottom-left. Tare subtracts a separate offset from each sensor.
- Rust CoP uses normalized coordinates. TCP/LSL sample timestamps use Unix
  microseconds; desktop channel timestamps use milliseconds. CSV uses RFC 3339.
- The processing `samplingRate` controls interpolation. `windowSlideMs` controls
  result cadence; the default 100 ms slide produces about 10 results per second.
- `MockBoardGen::seeded` plus `sample_at` supplies deterministic samples without
  a clock. Runtime demo mode is still randomized and paced in real time.
- A CLI recording that fails to finalize must return nonzero. The smoke suite
  checks both completed files and the failure path, not just process startup.
- Android and Rust session-settings JSON currently differ. Shared tare fixtures
  establish sensor agreement, not recording-format compatibility. Do not claim
  interchangeability without adding and passing an import/export contract test.

## Finishing a change

Preserve existing working-tree edits. Update the relevant guide when changing a
command, task or data contract. Keep expected fixture results independently
specified; do not regenerate expected values from the implementation under test.
Report the checks actually run and any environment or hardware limitations.
