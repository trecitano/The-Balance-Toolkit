import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../../", import.meta.url));
const config = readFileSync(`${root}/mise.toml`, "utf8");
let failures = 0;

function check(label, ok, detail) {
  console.log(`${ok ? "OK" : "MISSING"} ${label}: ${detail}`);
  if (!ok) failures++;
}

function command(name, args) {
  const result = spawnSync(name, args, { cwd: root, encoding: "utf8" });
  return { ok: result.status === 0, text: result.stdout?.trim() || result.stderr?.trim() || result.error?.message || "unavailable" };
}

for (const [tool, executable] of [["bun", "bun"], ["rust", "rustc"], ["uv", "uv"]]) {
  const expected = config.match(new RegExp(`^${tool} = "([^"]+)"`, "m"))?.[1];
  const result = command(executable, ["--version"]);
  const actual = result.text.match(/\b\d+\.\d+\.\d+\b/)?.[0];
  check(tool, result.ok && actual === expected, `${result.text}; required ${expected}. Run through mise.`);
}

for (const tool of ["cargo", "rustfmt", "cmake"]) {
  const result = command(tool, ["--version"]);
  check(tool, result.ok, result.text.split("\n")[0]);
}

if (process.platform === "linux") {
  for (const library of ["libudev", "dbus-1"]) {
    const result = command("pkg-config", ["--modversion", library]);
    check(library, result.ok, result.text);
  }
}

for (const tool of ["tsc", "vite", "oxlint"]) {
  check(tool, existsSync(`${root}/apps/gui/node_modules/.bin/${tool}`), "frontend dependency; install with mise exec -- bun install --frozen-lockfile in apps/gui");
}

console.log("This profile needs no Bluetooth service, board, display, Android SDK, or administrator privileges.");
console.log("Native library/compiler availability is checked fully by mise run check. See docs/DEVELOPMENT.md.");
process.exitCode = failures ? 1 : 0;
