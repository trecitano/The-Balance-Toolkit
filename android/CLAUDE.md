# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The Balance Toolkit is an Android app for measuring and analyzing postural stability using a Wii Balance Board. It connects via Bluetooth HID to read sensor data, calculates Center of Pressure (CoP) metrics, and records sessions to CSV files.

## Build Commands

```bash
# Build debug APK
./gradlew assembleDebug

# Build release APK
./gradlew assembleRelease

# Run linting
./gradlew detekt
./gradlew lintKotlin

# Format code
./gradlew formatKotlin

# Full check (lint + build)
./gradlew check
```

## Architecture

### Tech Stack
- **UI**: Jetpack Compose with Material 3
- **Navigation**: Navigation Compose with `NavigationSuiteScaffold` for adaptive navigation
- **DI**: Hilt
- **Database**: Room (SQLite)
- **Bluetooth**: Android Bluetooth HID with `HiddenApiBypass` library for accessing hidden APIs

### Package Structure

```
com.balancetoolkit/
├── bluetooth/       # Balance board connectivity
│   ├── WiiBalanceBoardHidConnection  # Real HID connection implementation
│   ├── MockBalanceBoardConnection    # Mock connection for testing
│   ├── BalanceBoardTypes             # SensorReading, TareValue, TareManager
│   └── ScanAndConnect                # Bluetooth scanning utilities
├── data/
│   ├── local/       # Room database (AppDatabase, DAOs, Entities)
│   └── model/       # Domain models (User, Device, Session)
├── di/              # Hilt modules (AppModule)
├── session/         # Session recording (SessionFileWriter, SessionConfiguration)
├── ui/
│   ├── components/  # Reusable Compose components
│   ├── navigation/  # AppDestination, AppNavHost
│   ├── screens/     # Screen composables by feature
│   └── theme/       # Material theme configuration
├── viewmodel/       # ViewModels for each screen
└── util/            # Utility classes
```

### Key Data Flow

1. **Sensor Data**: `WiiBalanceBoardHidConnection` reads raw sensor data from the balance board via Bluetooth HID polling
2. **Calibration**: Board calibration data is read from device memory (0kg, 17kg, 34kg reference points) and used to convert raw values to kg
3. **CoP Calculation**: `SessionViewModel` converts sensor readings to Center of Pressure using weighted average of sensor positions
4. **Metrics**: Real-time calculation of DPSI (Dynamic Postural Stability Index), velocity metrics, FFT amplitude spectrum, and confidence ellipse
5. **Recording**: `SessionFileWriter` saves sensor data to CSV and session metadata to JSON

### Navigation

Five main screens accessible via bottom/rail navigation:
- **Home**: Dashboard with quick access to start sessions
- **Users**: Manage user profiles (stored in Room database)
- **Devices**: Bluetooth device pairing and management
- **Session**: Real-time session recording with visualizations
- **Settings**: App configuration including mock mode toggle

### Bluetooth HID Connection

The app uses Android's hidden Bluetooth HID Host APIs via `HiddenApiBypass`. Key aspects:
- Profile type 4 (`HID_HOST_PROFILE`)
- Polling-based data retrieval (50ms interval)
- Supports both real board connection and mock mode for development

## Code Style

- Detekt and Kotlinter are configured for linting
- Max line length: 175 characters
- Composable function names can use PascalCase (ignored by FunctionNaming rule)
- No wildcard imports (except `java.util.*`)
