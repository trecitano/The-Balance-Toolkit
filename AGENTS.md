# AGENTS.md

Coding-agent runbook for `/Users/valter/Developer/The-Balance-Toolkit`.

## Scope

- Applies to the repository root and all subdirectories, except where a deeper `AGENTS.md` exists.
- `android/AGENTS.md` is the source of truth for work inside `android/`.

## Repository Snapshot

- Desktop app: Tauri v2 (`src-tauri/`) + React 19 + TypeScript + Vite (`src/`).
- Frontend package manager/runtime: Bun (`bun.lock` is committed).
- Rust workspace root includes `src-tauri` and excludes `macos-wii-balance-pair`.
- macOS helper crate: `macos-wii-balance-pair/` (built from `src-tauri/build.rs` on macOS).
- Python streaming inspection scripts: `scripts/` (`tbt_stream_tcp.py`, `tbt_stream_lsl.py`).

## Key Directories

- `src/`: React UI, routes, components, hooks, Zustand stores, Tauri invoke wrappers.
- `src/utils/requests.ts`: typed frontend command wrappers for all Tauri invoke calls.
- `src/services/BalanceBoardChannelManager.tsx`: event channel wiring for session/replay streams.
- `src/store/sessionDataStore.tsx`: in-memory ring buffer state for streaming/replay charts.
- `src-tauri/src/frontend/tauri.rs`: Tauri command handlers and event emission.
- `src-tauri/src/actors/toolkit_service.rs`: central app manager and command orchestration.
- `src-tauri/src/processing/`: data processor + file/LSL/TCP writers.
- `src-tauri/src/file_system.rs`: persisted JSON/settings/users/devices/session metadata.
- `src-tauri/capabilities/default.json`: window and plugin permissions.
- `scripts/`: external stream consumer tools for TCP/LSL validation.

## Build and Run Commands

Run from repository root unless noted.

```bash
# install frontend deps
bun install

# desktop dev (Tauri + Vite dev server on port 1420)
bun run tauri dev

# frontend production bundle
bun run build

# frontend lint (oxlint; currently warning-oriented)
bun run lint

# Rust desktop backend compile check
cargo check --manifest-path src-tauri/Cargo.toml

# macOS pairing helper compile check
cargo check --manifest-path macos-wii-balance-pair/Cargo.toml
```

Python scripts (optional validation tooling):

```bash
cd scripts
python3 tbt_stream_tcp.py
python3 tbt_stream_lsl.py
```

## Validation Expectations

- There are currently no committed frontend or `src-tauri` tests.
- `bun run lint` and both `cargo check` commands currently pass with warnings; warnings are existing project debt, not immediate blockers.
- For change validation, run only the smallest relevant checks first.

Recommended minimum checks by change type:

- Frontend (`src/`): `bun run lint`, then `bun run build` for broader confidence.
- Tauri/Rust (`src-tauri/`): `cargo check --manifest-path src-tauri/Cargo.toml`.
- macOS pairing helper: `cargo check --manifest-path macos-wii-balance-pair/Cargo.toml`.
- Streaming/output changes: run desktop session manually and verify TCP/LSL/script consumption.
- Android changes: follow `android/AGENTS.md`.

## Code Style and Conventions

- TypeScript is strict (`tsconfig.json`); preserve strong types and avoid `any`.
- Use `@/` imports for frontend source paths.
- Frontend data flow:
  - Tauri command calls through `src/utils/requests.ts`.
  - Query-style data through React Query.
  - High-frequency frame data through Zustand stores.
- Keep ring-buffer behavior in `sessionDataStore` intact (fixed-size rolling window).
- Rust is edition 2024; keep platform-specific code under existing module boundaries.
- Prefer minimal, targeted changes over broad refactors.
- Do not edit generated/build outputs (`dist/`, `target/`, `src-tauri/gen/schemas/`) unless explicitly requested.

## Domain Guardrails

- Preserve wire/data formats used by external consumers:
  - TCP raw packet layout (40-byte big-endian format from Rust output).
  - LSL stream naming split (`*_basic`, `*_complex`) and channel ordering.
- Preserve session file conventions:
  - session id pattern: `tbt-%Y-%m-%dT%H-%M-%S`
  - settings file suffix: `.settings.json`
  - per-device raw/processed CSV naming produced by `file_writer.rs`.
- Keep frontend and Rust payload contracts synchronized when changing event fields/types.
- Be careful with stability metrics and processing settings (`window size`, `slide`, `sampling`, `interpolation`); these affect replay and exported outputs.

## Persistence and Environment Notes

- Desktop app data persists under the user documents directory in `the-balance-toolkit` (see `app_dir()` in `src-tauri/src/file_system.rs`).
- Tauri build config (`src-tauri/tauri.conf.json`) drives:
  - dev URL `http://localhost:1420`
  - `beforeDevCommand: bun run dev`
  - `beforeBuildCommand: bun run build`
- On macOS, building `src-tauri` triggers a build of `macos-wii-balance-pair` via `src-tauri/build.rs`.

## Change Boundaries

- Keep architecture intact: `ConnectionManager` is the central authority for backend state.
- Avoid introducing new dependencies unless required by the task.
- Do not commit secrets or machine-local files.
- If a task is Android-only, operate in `android/` and follow `android/AGENTS.md`.
