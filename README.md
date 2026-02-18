# The Balance Toolkit

The Balance Toolkit is a multi-platform toolkit for working with Nintendo Wii Balance Board data.

This repository contains:

- A desktop app built with **Tauri + Rust + React/TypeScript**
- An Android app built with **Kotlin + Jetpack Compose** (`android/`)
- Python scripts for inspecting **TCP** and **LSL** data streams (`scripts/`)

## Installation

Installation prerequisites and full setup steps are documented in:

- [`INSTALL.MD`](./INSTALL.MD)

This README focuses on project structure and daily development commands.

## What It Does

- Manages users and Wii Balance Board devices
- Supports session recording and replay
- Computes and visualizes CoP/stability metrics
- Streams data via:
  - TCP
  - Lab Streaming Layer (LSL)
- Saves session outputs to disk:
  - raw CSV (`*-raw.csv`)
  - processed CSV (`*-processed.csv`)
  - session metadata/settings JSON (`*.settings.json`)

## Repository Layout

- `src/` - desktop frontend (React + TypeScript + Vite)
- `src-tauri/` - desktop backend (Rust + Tauri commands, Bluetooth, processing, file/stream writers)
- `android/` - Android app (see [`android/README.md`](./android/README.md))
- `macos-wii-balance-pair/` - macOS Bluetooth helper crate used by desktop build on macOS
- `scripts/` - Python TCP/LSL stream inspection tools

## Quick Start (Development)

Run from repository root.

```bash
# install frontend dependencies
bun install

# run desktop app in development mode
bun run tauri dev
```

## Useful Commands

```bash
# frontend lint
bun run lint

# frontend build
bun run build

# Rust backend compile check
cargo check --manifest-path src-tauri/Cargo.toml

# macOS helper compile check
cargo check --manifest-path macos-wii-balance-pair/Cargo.toml
```

Android module:

- Open `android/` in Android Studio, or
- Use command line from `android/` (details in [`android/README.md`](./android/README.md))

## Notes

- On macOS, building `src-tauri` also builds `macos-wii-balance-pair` via `src-tauri/build.rs`.
- The desktop app stores runtime data in a `the-balance-toolkit` directory under the user documents folder.

## Documentation

- Setup and prerequisites: [`INSTALL.MD`](./INSTALL.MD)
- Android module guide: [`android/README.md`](./android/README.md)
