#!/bin/bash
set -e

if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "➡️ Detected macOS. Running macOS build..."
  cargo build --manifest-path ./macos-wii-balance-pair/Cargo.toml
  bun run dev
else
  echo "➡️ Detected non-macOS. Running default build..."
  bun run dev
fi