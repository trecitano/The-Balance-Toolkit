# The Balance Toolkit (Android)

Android application for The Balance Toolkit, built with Kotlin + Jetpack Compose.

This app lets you manage users and Wii Balance Board devices, pair/connect over Bluetooth, run live sessions, and save session output files.

## What The App Does

- Create, edit, select, and delete users
- Scan, pair, connect, and select Wii Balance Boards
- Run sessions in real-device mode or mock mode
- Save session files as:
  - raw CSV (`*-raw.csv`)
  - session settings JSON (`*.settings.json`)

## Tech Stack

- Kotlin + Jetpack Compose (Material 3)
- Hilt (dependency injection)
- Room (local persistence)
- Gradle version: [wrapper configuration](gradle/wrapper/gradle-wrapper.properties)
- Kotlin, Android plugin and library versions: [version catalog](gradle/libs.versions.toml)
- SDK levels and bytecode target: [app build configuration](app/build.gradle.kts)

## Requirements

- Android Studio (latest stable recommended)
- Android SDK 36 installed
- A device or emulator running Android 13+ (API 33+)
- For terminal builds, configure `JAVA_HOME` (CI uses JDK 21) and `ANDROID_HOME`.
  JVM unit tests need the JDK and SDK but do not need a device or emulator.

## Android Studio Setup (Recommended)

1. Open Android Studio.
2. Select **Open**.
3. Choose the `android/` directory from this repository.
4. Wait for Gradle sync to complete.

## Run The App In Android Studio

1. Select the `app` run configuration.
2. Choose a connected device or emulator.
3. Click **Run**.

## Build In Android Studio

- Build debug APK: **Build > Build APK(s)**
- Rebuild: **Build > Rebuild Project**
- Clean: **Build > Clean Project**

Optional command-line equivalents (run from `android/`):

```bash
./gradlew :app:assembleDebug
./gradlew :app:assembleRelease
./gradlew :app:build
```

## Validation Checks

JVM unit tests cover tare and weight using the same synthetic sensor fixtures as
the Rust core. No instrumentation tests are committed. Run tests, static checks
and a debug build from `android/`:

```bash
./gradlew :app:testDebugUnitTest
./gradlew lintKotlin detekt :app:assembleDebug
```

From the repository root, use `mise run test:android` and `mise run check:android`.
See [development verification](../docs/DEVELOPMENT.md) for the CI workflow and
[fixture documentation](../tests/fixtures/README.md) for coverage. Shared sensor
fixtures do not imply recording compatibility: Android session-settings JSON
currently differs from the Rust desktop/CLI format.

## Permissions And Storage

- The app requests Bluetooth permissions needed for board discovery and connection.
- Session output supports both:
  - normal filesystem paths
  - SAF tree URIs (`content://...`)
- Output location is configurable in the app settings screen.

## Signing Notes

- `keystore.properties` is optional.
- `keystore.properties.example` shows the expected fields.
- Do not commit local/secret files:
  - `keystore.properties`
  - `*.jks`, `*.keystore`
  - `local.properties`

## Project Structure

- `app/src/main/java/com/balancetoolkit/MainActivity.kt` - app shell + navigation
- `app/src/main/java/com/balancetoolkit/viewmodel/` - screen state and business logic
- `app/src/main/java/com/balancetoolkit/ui/screens/` - feature screens
- `app/src/main/java/com/balancetoolkit/ui/components/` - reusable Compose components
- `app/src/main/java/com/balancetoolkit/data/` - models, repositories, preferences
- `app/src/main/java/com/balancetoolkit/data/local/` - Room database, entities, DAOs
- `app/src/main/java/com/balancetoolkit/bluetooth/` - scan, pairing, and connection flow
- `app/src/main/java/com/balancetoolkit/session/` - session file writing and config schema
