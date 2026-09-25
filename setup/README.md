# Setup scripts

One entry point checks every development dependency for The Balance Toolkit,
reports what is installed and what is missing, and offers a checklist of the
missing items to install. The checklist has two sections: **Required** items
are ticked by default, **Optional** items (end-to-end test tooling, the Python
streaming clients, Unity Hub) are listed unticked.

```bash
setup/setup.sh              # Linux and macOS (also works from Git Bash on Windows)
setup/setup.sh --check      # report only, exit 1 if a required item is missing
setup/setup.sh --yes        # install the default selection without prompting
setup/setup.sh --all        # install everything missing, including optional items
```

Windows, from PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File setup\setup.ps1    # same flags: -Check, -Yes, -All
```

Windows setup installs CMake using its machine-wide MSI and refreshes its own
PATH before verifying it. Accept any Windows elevation prompts. Success requires
every required dependency to pass its final check; failed installations and
required items left unselected produce a nonzero exit status. The summary repeats
installer errors. Fix the reported cause and rerun setup to resume; dependencies
that pass their checks are skipped. A Visual Studio installation may still require
a restart, which setup reports separately.

After setup, run `mise run dev:desktop` from the repository root. PowerShell
profile activation is not required for this command. If setup ran in a child
PowerShell process, open a new terminal to pick up newly installed programs on
PATH. The desktop task installs the frontend packages automatically.

Once mise is installed, `mise run setup` runs the right script for the current
platform and forwards any arguments (`mise run setup -- --check`). The scripts
are what bootstrap mise in the first place, so the direct invocations above are
for a fresh machine.

In the checklist use ↑/↓ (or j/k) to move, space to toggle, `a`/`n` to select
all/none, enter to install the selection and `q` to quit without installing.
Run as your normal user; sudo (or winget/UAC on Windows) is requested where
needed. Bun and Rust are pinned in `../mise.toml` and installed by mise; the script
installs mise and runs `mise install`. When it installs mise, the Unix script
prints the activation command for your current shell (bash, zsh or fish).
Run that command, then `mise run dev:desktop` from the repository root, as shown
in the final setup message. The desktop task installs frontend dependencies
from the committed lockfile before generating icons and launching Tauri.
An outdated Bun or Rust shows up as "missing or outdated" and
`mise install` fetches the pinned version.

## Layout

| Path | Purpose |
| --- | --- |
| `setup.sh` | Unix entry point: detects the platform, runs the checks, shows the checklist, installs. Forwards to `setup.ps1` under Git Bash. |
| `setup.ps1` | Windows equivalent of the whole flow, installing through winget. |
| `lib/common.sh` | Dependency registry, output helpers, and checks shared by all Unix platforms. |
| `lib/checkbox.sh` | Interactive checkbox picker (bash 3.2 compatible for macOS). |
| `ubuntu/deps.sh` | Debian/Ubuntu (apt) dependency list. |
| `archlinux/deps.sh` | Arch Linux (pacman) dependency list. |
| `archlinux/install-webkit-webdriver.sh` | Builds `WebKitWebDriver` from source on Arch; also reachable as `setup/setup.sh webdriver`. |
| `macos/deps.sh` | macOS (Xcode CLT, Homebrew) dependency list. |

Platform detection uses `uname` and `/etc/os-release` (`ID` and `ID_LIKE`), so
Arch and Debian derivatives are routed to the matching module.

## What is checked

| Item | Ubuntu | Arch | macOS | Windows |
| --- | --- | --- | --- | --- |
| Tauri system libraries | apt | pacman | Xcode CLT | VS C++ Build Tools, WebView2 |
| CMake (liblsl) | apt | pacman | brew | winget |
| mise | curl | pacman | brew | winget |
| Bun, Rust, uv pinned in `mise.toml` | `mise install` | `mise install` | `mise install` | `mise install` |
| Homebrew | | | ✔ | |
| BlueZ + `bluetooth.service` | ✔ | ✔ | | |
| Balance Board hidraw udev rule | ✔ | ✔ | | |
| User in `input` group | ✔ | ✔ | | |
| `tauri-driver` (optional) | ✔ | ✔ | ✔ | ✔ |
| Platform WebDriver (optional) | `webkit2gtk-driver` | source build | n/a | `msedgedriver` (downloaded to match Edge) |
| Python streaming clients, `scripts/` (optional) | `uv sync` | `uv sync` | `uv sync` | `uv sync` |
| Unity Hub (optional) | Unity apt repo | AUR (`paru`/`yay`) | brew cask | winget |

On Windows the toolchain row also runs `rustup set auto-self-update disable`
when rustup is already present: rustup's post-install self-update check can
fail to launch its updater there, which would otherwise make `mise install`
exit nonzero after every pinned tool was installed. Update rustup itself with
`rustup self update` when you want to. If `mise install` still exits nonzero
but `mise ls --missing` reports nothing, the row is treated as installed with
a warning.

The toolchain row installs `uv` too; the Python clients row runs `uv sync
--locked` in `scripts/`, which downloads the Python pinned in
`scripts/.python-version` if needed. The Unity Hub row installs only the Hub;
Unity Editors are installed from inside the Hub, since the version depends on
the Unity project.

## Adding a dependency

The Windows setup control-flow regression checks can run without installing
packages, on any platform with PowerShell:

```powershell
pwsh -NoProfile -File scripts/verify/windows-setup.Tests.ps1
```

These use simulated installers to check failure and success exit statuses; an
actual Windows installation is still needed to validate WinGet and MSI behavior.

Add a check function and an install function to the platform module (or to
`lib/common.sh` if shared), then register them:

```bash
dep_add <id> '<label>' <check_fn> <install_fn> [required|optional]
```

The kind decides which section of the checklist the item appears in and
whether it is ticked by default. A check returns 0 when satisfied and may set
`DETAIL` to a short note (version, path, or reason). Install functions can call `post_note '...'` to print a
reminder at the end (for example, "log out and back in"). On Windows, add a
matching `Check-*`/`Install-*` pair and a row in `$Deps` in `setup.ps1`.
