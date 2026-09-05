# Synthetic test fixtures

These files contain synthetic values only; no participant recordings or personal
data are used. Keep them small and commit changes with the behavior they specify.

## sensors.json

Each case defines `reading`, `tare`, and `expected` arrays in this order:
top-right, bottom-right, top-left, bottom-left. Values and `weight` are kilograms.
`expected` is the sensor vector after tare. `cop` is the expected Rust normalized
center of pressure `[x, y]` after tare, with positive axes pointing right and up.

`crates/toolkit-core/tests/sensors.rs` checks tare, CoP and sample identity.
Android's `TareManagerTest` loads the same file through Gradle test resources and
checks tare and total weight. Its test does not assert the Rust CoP convention
for negative loads; Android currently handles those differently.

## recording/

The settings and raw CSV are a hand-authored desktop/CLI recording. Five samples
describe a constant 80 kg load moving right and back to center. The one-second
session includes idle time after its last sample so replay can finish reading
the short file before the session timer expires. The processed file has only
its header: replay consumes the raw file and computes new processed values.

The contract test loads settings through the production Rust loader and checks
JSON round-trip preservation. The CLI smoke test replays this recording and
compares all five raw sensor vectors to independently specified values.

This is not the Android session-settings format. Shared sensor tests do not
establish Android/Desktop recording interchangeability.

## Adding cases

Calculate expected values independently and explain the scenario. Use explicit
timestamps and tolerances appropriate to floating-point math. For generated
motion, use a seeded `MockBoardGen` and pass time explicitly to `sample_at`.
Do not snapshot randomized runtime demo sessions as expected results.
