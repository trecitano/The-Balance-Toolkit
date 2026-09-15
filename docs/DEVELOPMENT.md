# Development and verification

The default verification profile runs the Rust core, headless CLI and frontend
checks without a display, Wii Balance Board or running Bluetooth service.
Native HID, D-Bus and LSL libraries are still build dependencies.

## First setup

Install mise and the platform prerequisites in [INSTALL.md](../INSTALL.md).
For the default verification profile on Debian/Ubuntu:

```bash
sudo apt-get install build-essential cmake pkg-config libudev-dev libdbus-1-dev libssl-dev
```

Then, from the repository root:

```bash
mise install
(cd apps/tauri && mise exec -- bun install --frozen-lockfile)
mise run doctor
mise run verify
```

Use `mise exec --` in noninteractive shells instead of relying on shell
activation. Tool versions live in `mise.toml`; dependencies live in the
committed Bun, Cargo and uv lockfiles. Update those intentionally when changing
dependencies. Rust commands in the verification tasks use `--locked`.

`doctor` checks the active tool versions, native build prerequisites and installed
frontend executables. It does not install packages, start Bluetooth or change
group membership. `mise run setup -- --check` is the broader desktop/hardware setup
check and can fail on machines that can still run this verification profile.

## Running and building the apps

After setup, run these tasks from the repository root:

| Command | Result |
|---|---|
| `mise run dev:desktop` | Launch the Tauri desktop app in development mode |
| `mise run dev:cli` | Launch the interactive terminal dashboard; press `?` for controls and `q` to quit |
| `mise run build:desktop` | Build the release desktop executable in `target/release/` and platform packages in `target/release/bundle/` |
| `mise run build:cli` | Build the release CLI at `target/release/tbt` (`tbt.exe` on Windows) |

Desktop tasks run in `apps/tauri/` automatically and require the frontend
dependencies and platform GUI prerequisites from [INSTALL.md](../INSTALL.md).
The desktop build also builds the frontend and packages for the current platform.

Extra arguments are forwarded to the underlying command. For example:

```bash
mise run dev:cli -- devices list
mise run dev:cli -- --help
mise run build:desktop -- --no-bundle
```

Run the release CLI directly with `./target/release/tbt`. Launch the release
desktop executable or install a generated package. For Android, use
[Android Studio](../apps/android/README.md#run-the-app-in-android-studio).

## Commands and success criteria

| Command | What passes |
|---|---|
| `mise run check` | Rust formatting and core/CLI compilation; frontend lint and production build |
| `mise run test` | Core sensor, deterministic mock, processing and recording-contract tests; CLI unit tests |
| `mise run smoke` | Isolated CLI recording/replay, fixture playback and nonzero failures |
| `mise run verify` | `doctor`, `check`, `test`, then `smoke`, stopping on failure |
| `mise run check:desktop` | Tauri shell compilation with platform GUI development libraries installed, and the committed TypeScript bindings match the Rust commands |
| `mise run gen:bindings` | Regenerates `apps/tauri/src/bindings.ts` from the Tauri bridge (also happens on every debug desktop launch) |
| `mise run test:android` | Android JVM tests, including the shared sensor fixtures; no emulator needed |
| `mise run check:android` | Android lint, Detekt and debug APK build |

These commands run locally; no CI workflow is currently present. Android JVM
tests run separately because they require an Android SDK environment. Native
desktop packaging and physical Bluetooth tests are not covered by `verify`.
Existing frontend lint warnings remain visible but are not fatal; TypeScript
errors and build failures are fatal.

For a focused test, use its actual name, for example:

```bash
mise exec -- cargo test --locked -p toolkit-core known_motion_has_velocity
mise exec -- cargo test --locked -p toolkit-cli --test smoke recording_failure
```

## Test data and isolation

The smoke tests launch the built `tbt` binary with a fresh `TBT_APP_DIR` and
explicit demo settings for every test. They use one known mock board, separate
recording/replay directories, closed stdin and a 25-second timeout per process.
They check JSON Lines, recorded data and final session metadata. Temporary
directories and logs are removed when each test finishes; failed commands include
stderr in the test output.

The failure regression intentionally uses a mock board name containing a path
separator. This currently reaches a failed CSV writer; the command must report
failure rather than exit successfully. Finalization has a 10-second timeout, so
this test takes roughly 11 seconds. Filename validation is not yet implemented.

Use [tests/fixtures](../tests/fixtures/README.md) for fixed inputs. Runtime demo
sessions are randomized. Tests that need repeatable sensor values use
`MockBoardGen::seeded(mac, seed)` and `sample_at(elapsed, timestamp)`; neither the
sample values nor their timestamps depend on wall-clock scheduling.

The Android and Rust tests share tare/weight examples. Their session JSON schemas
remain different; the desktop recording fixture proves Rust record/replay
compatibility only. Cross-platform recording import requires a separate migration.

Session and replay configurations keep their active timestamp and timer in one
`running: Option<RunningSession>`. Clearing or replacing it cancels that run's
timer; queued auto-stop commands also check cancellation before stopping boards.
The manager emits completion when it stops an active run; cancelled timers exit
without emitting completion for a replacement run.
These configurations are not cloneable because they own the running lifecycle.
Activity progress reports zero-based loop and block indices, uses a single loop's
duration to advance between loops, and has no ongoing state after the final loop.
The core unit tests cover these rules alongside observer backpressure and sway
calculations with uneven sample intervals. Serialized session settings retain
their existing format.

## Desktop frontend state and forms

Shared query definitions and mutation invalidation live in
`apps/tauri/src/queries/toolkit.ts`. Pages compose these queries instead of caching
activities or devices in page-specific bundles. `ToolkitEvents` refreshes affected
resources throughout each desktop window; `useTauriEvent` owns subscription cleanup.

Numeric processing fields keep a local draft. Blur or Enter saves a positive whole
number; Escape discards the draft. Empty and invalid drafts never reach the backend,
and the Start control waits until drafts and pending saves are resolved. Activity
and user forms keep failed saves editable. Switching users and closing an edited
activity require an explicit discard; reopening an editor starts a fresh draft.
Settings drafts exist only while the settings form is mounted.

The Users page composes `UserCarousel`, `UserEditor`, and `WeightMeasureModal`.
Measurement readings update only the mounted modal, at most once per animation
frame. Readings arrive in kilograms and are converted for a pounds display. The
shared modal uses the browser's modal dialog API for focus containment, Escape,
and focus restoration, with an accessible name supplied by each caller.

`user_measure_weight` takes a caller-generated `measurement_id` and acknowledges
whether the core started the stream. `user_stop_measure_weight` stops only that
identifier. The modal stops its measurement on close or unmount; dropping a
JavaScript channel alone is insufficient. The core finishes measurement cleanup
before a session or calibration takes over a board. Late cleanup for an old
identifier cannot stop the replacement stream. Starting a session also refreshes
the selected user and activity from their saved definitions.

Plots share creation, resizing, and destruction through `useUPlot`; data updates
remain direct store subscriptions. Timeline animation stops on unmount or session
completion. The activity popup uses backend progress and polls while running.

## Android environment

Install a JDK (JDK 25 is supported), Android SDK platform 36 and its build tools.
Set `JAVA_HOME` and `ANDROID_HOME`, or configure the SDK through Android Studio.
Use the committed Gradle wrapper. The Java target in the app build file is a
bytecode target, not the version of Java required to run Gradle.

Detekt is pinned to `2.0.0-alpha.6`, which supports JDK 25. This is a prerelease
build tool; its plugin ID and rule configuration use the Detekt 2 format.
JDK 21 is not required as a workaround for the older Detekt compiler.
See the [upstream compatibility table](https://detekt.dev/docs/introduction/compatibility/).

The Android static checks currently report 21 source findings: broad exception
catches and unused parameters. `check:android` fails on these findings. Review
the generated `apps/android/app/build/reports/detekt/detekt.html` report when
addressing them; `test:android` runs JVM tests separately.

```bash
mise run test:android
mise run check:android
```

Gradle needs writable wrapper/dependency caches. Missing SDKs, JDKs or dependencies
are setup failures, not passing tests. See [apps/android/README.md](../apps/android/README.md)
for device setup and app operation.

## Troubleshooting

- Wrong Rust or Bun version: use `mise exec -- rustc --version` / `mise exec -- bun --version`, then `mise install` if missing.
- Missing frontend executable: run `mise exec -- bun install --frozen-lockfile` in `apps/tauri/`.
- Rust format failures: run `mise exec -- cargo fmt --all`, then review the diff.
- Build blocked by another Cargo invocation: wait, or set `CARGO_TARGET_DIR` to a separate build directory.
- Missing Linux native library: run `mise run doctor` and install the development package named in the diagnostic.
- To inspect backend logs, use `TBT_LOG=debug mise run dev:desktop` from the repository root; `bun run dev` in `apps/tauri/` starts only Vite.

Once dependencies are cached, Cargo tests can also run with `--offline`.
The first setup and dependency installation need network access.
