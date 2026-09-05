# AGENTS.md

Coding-agent runbook for `apps/android/`. Also read the [root runbook](../../AGENTS.md).

## Scope

- Applies only to the Android project in this directory (`:app` module).
- This app is Kotlin + Jetpack Compose + Hilt + Room.
- It manages users/devices, pairs Wii Balance Boards over Bluetooth, and records session data.

## Project Snapshot

- Gradle version: `gradle/wrapper/gradle-wrapper.properties`
- Plugin/library versions: `gradle/libs.versions.toml`
- SDK levels and bytecode target: `app/build.gradle.kts`
- Set `JAVA_HOME` and `ANDROID_HOME` for terminal builds; CI uses JDK 21.
- DI: Hilt
- Persistence: Room
- UI: Compose Material3 + adaptive navigation suite
- Bluetooth HID access: `org.lsposed.hiddenapibypass`

## Directory Map

- `app/src/main/java/com/balancetoolkit/MainActivity.kt`: app shell + navigation scaffold
- `app/src/main/java/com/balancetoolkit/BalanceToolkitApplication.kt`: Hilt app entry
- `app/src/main/java/com/balancetoolkit/di/`: dependency injection modules
- `app/src/main/java/com/balancetoolkit/viewmodel/`: screen-level state and business logic
- `app/src/main/java/com/balancetoolkit/ui/screens/`: feature screens (home/users/devices/session/settings)
- `app/src/main/java/com/balancetoolkit/ui/components/`: reusable UI building blocks/dialogs
- `app/src/main/java/com/balancetoolkit/data/`: shared prefs keys, units, repositories, result wrappers
- `app/src/main/java/com/balancetoolkit/data/local/`: Room DB, entities, converters, DAOs
- `app/src/main/java/com/balancetoolkit/bluetooth/`: scanning, pairing, HID connection, mock connection
- `app/src/main/java/com/balancetoolkit/session/`: session file writing + settings JSON schema

## Key Runtime Flows

- User selection is shared via `UserSelectionRepository` (SharedPreferences + `StateFlow`).
- Device selection/connection status is persisted in Room and mapped via `toBoardSelectionInfo()`.
- Session recording runs through `SessionViewModel` and `BalanceBoardConnectionManager`:
  - mock mode: `MockBalanceBoardConnection`
  - real mode: `WiiBalanceBoardHidConnection`
- Session output writes both:
  - raw CSV (`*-raw.csv`)
  - session config JSON (`*.settings.json`)
- `SessionConfiguration` currently differs from the Rust recording format (field naming, user IDs, duration and file mappings). Preserve existing Android files until an explicit migration is implemented; do not assume Rust replay can load them.
- Tare and total-weight examples are shared with Rust in `../tests/fixtures/sensors.json`. `TareManagerTest` loads this exact resource; do not copy it into the Android tree.

## Build, Lint, and Test Commands

Run from `apps/android/`.

```bash
./gradlew :app:testDebugUnitTest
./gradlew lintKotlin detekt :app:assembleDebug
```

Run the shared fixture tests alone:

```bash
./gradlew :app:testDebugUnitTest --tests "com.balancetoolkit.bluetooth.TareManagerTest"
```

Current status:

- JVM tests cover tare/weight behavior. No instrumentation tests are committed.
- From the repository root, `mise run test:android` and `mise run check:android` invoke the corresponding checks.

## Validation Workflow for Agents

1. Run the smallest relevant checks first (targeted test or lint task).
2. Run `./gradlew :app:testDebugUnitTest` and, for Kotlin/Compose changes, at least:
   - `./gradlew lintKotlin detekt :app:assembleDebug`
3. For broader confidence, run:
   - `./gradlew :app:build`
4. For Bluetooth/session changes, prefer real-device/manual verification in addition to Gradle checks.

## Code Style and Patterns

### Enforced by config

- Detekt + Kotlinter are enabled.
- Max line length is 175.
- Wildcard imports are disallowed except `java.util.*`.
- `@Composable` naming may be PascalCase.

### Kotlin/Compose conventions used in this codebase

- Keep mutable state private (`MutableStateFlow`), expose immutable (`StateFlow`).
- Prefer immutable UI state data classes and `.copy(...)` updates.
- Collect flows in Compose with `collectAsStateWithLifecycle`.
- Keep business logic in ViewModels/helpers, not in composables.
- Use explicit mapping boundaries (`toEntity`, `toUser`, `toDevice`).
- Prefer `runCatching` or explicit result-style handling for recoverable errors.

## Domain-Specific Guardrails

- Do not break pairing flow assumptions:
  - Host MAC address is required and parsed for PIN generation.
  - Pairing and connection updates are event-driven (`ScanEvent`).
- Do not break mock mode behavior:
  - Mock boards are synchronized via `syncMockBoards`.
- Be careful with session processing math:
  - CoP, velocity, DPSI, FFT, interpolation, and confidence ellipse logic are performance-sensitive.
  - Session processing settings are snapshotted when session starts.
- Keep both file output modes working:
  - normal filesystem path
  - SAF `content://` tree URI

## Permissions and Storage Notes

- Manifest includes Bluetooth permissions and `MANAGE_EXTERNAL_STORAGE`.
- Settings allow either filesystem directories or SAF URIs for session output.
- `keystore.properties` is optional; release falls back to debug signing if missing.
- Never commit secrets or local-only files:
  - `keystore.properties`
  - `*.jks`, `*.keystore`
  - `local.properties`

## Change Boundaries

- Make minimal, targeted changes.
- Preserve existing naming and architecture in touched areas.
- Avoid unrelated refactors and dependency additions unless required.
- Add comments only for non-obvious logic.
