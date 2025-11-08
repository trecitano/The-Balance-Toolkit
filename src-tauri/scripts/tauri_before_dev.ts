import { $ } from "bun";

// Exit immediately on errors
$.throws(true);

async function main() {
  if (process.platform === "darwin") {
    console.log("➡️ Detected macOS. Running macOS build...");
    await $`cargo build --manifest-path ./macos-wii-balance-pair/Cargo.toml`;
    await $`bun run dev`;
  } else {
    console.log("➡️ Detected non-macOS. Running default build...");
    await $`bun run dev`;
  }
}

await main();
