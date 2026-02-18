## System Requirements

The app works in Windows, MacOS and Unix distros.

The project is using:

- Bun 1.2.18
- Rust 1.88
- Cmake 4.0.3

At the moment of writing, these are the latest versions.
Later versions of these tools should work.

### Windows Base Requirements

- Windows 10/11
- PowerShell or Command Prompt with administrator privileges

2. Install Microsoft Visual Studio C++ Build Tools:
   - Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
   - Install "Desktop development with C++"
   - This may require a system restart

3. Install WebView2:
   - Download from: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### MacOS Base Requirements

- macOS 10.15 or later
- [Homebrew](https://brew.sh/)
- Ensure Xcode Command Line Tools are installed:
  - Open Terminal and run:

```bash
xcode-select --install
```

### Unix Base Requirements

For Linux development, install the system dependencies required by Tauri.

Use the command set for your distro:

Debian/Ubuntu:

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

Arch Linux:

```bash
sudo pacman -Syu
sudo pacman -S --needed \
  webkit2gtk-4.1 \
  base-devel \
  curl \
  wget \
  file \
  openssl \
  appmenu-gtk-module \
  libappindicator-gtk3 \
  librsvg \
  xdotool
```

If your distro is different, use the equivalent packages from the Tauri Linux prerequisites:
https://v2.tauri.app/start/prerequisites/

For real Wii Balance Board usage on Linux, also ensure BlueZ is installed and the Bluetooth service is running.

### Bun

Bun is necessary for everything frontend related.

[Bun Installation guide](https://bun.com/)

### Rust

Rust is necessary for everything backend related.

[Rust Installation guide (rustup)](https://rustup.rs/)

### Cmake

We need Cmake due to add support for the Lab Streaming Layer.
The [dependency](https://github.com/labstreaminglayer/liblsl-rust) we use for this feature requires cmake.

Windows:

- [Windows Cmake installation guide](https://cmake.org/download/)

MacOS:

- Open the terminal and run:

```bash
brew install cmake
```

## Step 3: Verify Installations

Run these commands to verify your installations:

```bash
# Check Rust
rustc --version
cargo --version

# Check Bun
bun -v

# Check CMake
cmake --version
```

## Running the Application

Initial setup:

install the frontend dependencies with:

```bash
bun install
```

This is only required the first time. After this, it is possible to run the scripts that exist in the `package.json` file.

Development mode:

```bash
bun run tauri dev
```

Build for production:

```bash
bun run tauri build
```

## Troubleshooting

### Common Issues

1. Rust Build Failures
   - Ensure all Visual Studio components are properly installed (Windows)
   - Check that Xcode Command Line Tools are installed (macOS)
   - Try running `rustup update`

2. WebView2 Issues (Windows)
   - Reinstall WebView2 Runtime
   - Check system environment variables

3. Build Issues
   - Check that all dependencies are installed
   - Try cleaning and rebuilding:
     ```bash
     bun run tauri clean
     bun run dev
     ```

## Additional Resources

- [Tauri Official Documentation](https://tauri.app/v1/guides/)
- [Rust Documentation](https://www.rust-lang.org/learn)
