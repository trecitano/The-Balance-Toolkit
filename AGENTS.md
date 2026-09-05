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
| `apps/desktop/src-tauri/` | Desktop shell, Tauri commands and event serialization |
| `apps/desktop/src/` | React UI, queries, frame storage and plots |
| `apps/android/` | Separate Kotlin application; also read `apps/android/AGENTS.md` |
| `tests/fixtures/` | Synthetic sensor cases shared with Android and desktop recording examples |
| `scripts/verify/` | Development diagnostics |

The desktop shell and CLI share the Rust core. Android does not use that core.
Keep UI/toolkit boundaries explicit; TypeScript command types are currently
maintained manually in `apps/desktop/src/types.ts` and `apps/desktop/src/utils/requests.ts`.

## Verification

Run from the repository root. All commands below are noninteractive.

| Change | Checks |
|---|---|
| Rust math, types or persistence | `mise run check:rust` and `mise run test` |
| CLI, recording or replay | Above, plus `mise run smoke` |
| React/TypeScript | `mise run check:frontend` |
| Tauri bridge | `mise run check:rust`, `mise run check:desktop`, `mise run check:frontend` |
| Shared sensor fixtures | `mise run test` and `mise run test:android` |
| Android | `mise run test:android` and `mise run check:android` |
| Full default CI profile | `mise run verify` |

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
