# System Requirements

## Quick setup

The repository ships a setup script that checks every dependency below,
shows what is installed and what is missing, and lets you pick what to
install from a checklist. Required items are ticked by default; optional
items (end-to-end test tooling, the Python streaming clients in `scripts/`,
Unity Hub) are listed unticked:

```bash
./setup.sh            # Ubuntu/Debian, Arch Linux, macOS
./setup.sh --check    # only report
```

```powershell
powershell -ExecutionPolicy Bypass -File setup.ps1    # Windows
```

See [setup/README.md](setup/README.md) for details. The rest of this document
describes the manual steps the script automates.

The app works in Windows, MacOS and Unix distros.

The project pins its Bun, Rust and uv versions in [`mise.toml`](mise.toml) and
installs them with [mise](https://mise.jdx.dev), so every platform builds with
the same toolchain. CMake is installed with the system package manager.

## Windows

- Windows 10/11
- PowerShell or Command Prompt with administrator privileges

2. Install Microsoft Visual Studio C++ Build Tools:
   - Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
   - Install "Desktop development with C++"
   - This may require a system restart

3. Install WebView2:
   - Download from: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

## MacOS

- macOS 10.15 or later
- [Homebrew](https://brew.sh/)
- Ensure Xcode Command Line Tools are installed:
  - Open Terminal and run:

```bash
xcode-select --install
```

## Unix

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
  libudev-dev \
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

#### Balance Board hidraw permissions

In linux systems, the user needs to have access to the hidraw device so that the Balance Toolkit can read and send reports.
To do this, please run the commands below:

```bash
sudo cp linux/99-nintendo-hidraw.rules /etc/udev/rules.d/
sudo udevadm control --reload
sudo usermod -aG input "$USER"
```

Then **log out and log back in** for the changes to take effect.

# Software Requirements

### Bun, Rust and uv (via mise)

Bun builds the frontend, Rust builds the backend, and uv runs the Python
streaming clients in `scripts/`. All three versions are pinned in `mise.toml`
at the repository root. Install mise, then from the repository
root run:

```bash
mise install
```

mise downloads its own copies of Bun, Rust and uv at the pinned versions; a Bun
or Rust already installed by your system is not used. Activate mise in your shell
so `bun` and `cargo` resolve to the pinned versions inside the repository:

```bash
echo 'eval "$(mise activate bash)"' >> ~/.bashrc                    # bash
echo 'eval "$(mise activate zsh)"'  >> ~/.zshrc                     # zsh
echo 'mise activate fish | source'  >> ~/.config/fish/config.fish   # fish
```

```powershell
Add-Content $PROFILE 'mise activate pwsh | Out-String | Invoke-Expression'   # PowerShell
```

Install mise itself with `brew install mise` (macOS), `sudo pacman -S mise`
(Arch), `curl https://mise.run | sh` (other Linux) or `winget install jdx.mise`
(Windows). To update the toolchain, edit the versions in `mise.toml` and rerun
`mise install`.

### Python streaming clients (optional)

The scripts in [`scripts/`](scripts/) inspect the TCP and LSL streams. Their
Python version is pinned in `scripts/.python-version` and their packages in
`scripts/uv.lock`. From `scripts/` run:

```bash
uv sync
```

uv downloads the pinned Python if it is not on your machine, creates
`scripts/.venv`, and installs the locked packages. Run a script with
`uv run tbt_stream_tcp.py`.

### Unity Hub (optional)

Unity is one possible consumer of the live stream and is not needed to build
the toolkit. The setup script can install Unity Hub (Unity's apt repository on
Debian/Ubuntu, the `unityhub` AUR package on Arch via `paru` or `yay`,
`brew install --cask unity-hub` on macOS, `winget install Unity.UnityHub` on
Windows). Install the Editor version your Unity project needs from inside the
Hub.

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

Linux:

- Debian/Ubuntu:

```bash
sudo apt install cmake
```

- Arch Linux:

```bash
sudo pacman -S --needed cmake
```


### End-to-end testing tools (optional)

To drive the desktop app from automated tests you need `tauri-driver` plus the
WebDriver for the platform webview. This is only needed for end-to-end tests;
skip it if you only build and run the app. Desktop support is limited to Linux
and Windows: macOS has no WKWebView driver.

Install `tauri-driver` with Cargo on every platform:

```bash
cargo install tauri-driver --locked
```

Linux (WebKitGTK) needs the `WebKitWebDriver` binary:

- Debian/Ubuntu:

```bash
sudo apt install webkit2gtk-driver
```

- Arch Linux: the `webkit2gtk-4.1` package does not include WebDriver. Run the
  repository installer as your normal user from the repository root:

```bash
./setup.sh webdriver
```

The entry point detects your distro and invokes
`setup/archlinux/install-webkit-webdriver.sh` on Arch Linux or a distro declaring
Arch compatibility. It is also offered as an optional item in the `./setup.sh`
checklist. See [setup/README.md](setup/README.md) for the setup directory structure.

The Arch script installs build dependencies using `sudo pacman`, detects your installed
WebKitGTK version, and builds only `WebKitWebDriver` with the default compiler and
all available CPU cores. It installs the binary into `/usr/local/bin` using
`sudo`. Build files remain in a temporary directory printed by the script.
Rerun it after updating `webkit2gtk-4.1`.

Use `--build-only` to build without installing the binary, and
`--skip-dependencies` if the build dependencies are already installed. See
`./setup.sh webdriver --help` for details. The script is adapted from this
[Arch WebKitWebDriver guide](https://gist.github.com/jamesmeneghello/37fc7988ec94edc962969ade428cd710).

Windows needs `msedgedriver.exe` matching the installed Edge version, on the
`PATH` or passed to `tauri-driver --native-driver`:

- [Microsoft Edge WebDriver](https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/)

Reference: [Tauri WebDriver manual setup](https://v2.tauri.app/develop/tests/webdriver/manual-setup/).

## Verification

Run these commands to verify your installations:

```bash
# Check the pinned toolchain (prints nothing when everything is installed)
mise ls --missing

# Check Rust
rustc --version
cargo --version

# Check Bun
bun -v

# Check CMake
cmake --version

# Check the end-to-end testing tools (optional)
tauri-driver --version
which WebKitWebDriver   # Linux only
```

# Running the Application

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
