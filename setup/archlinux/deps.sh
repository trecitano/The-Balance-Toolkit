#!/usr/bin/env bash
# Arch Linux dependencies. Sourced by setup/setup.sh.

PACMAN_PACKAGES=(
  webkit2gtk-4.1 base-devel curl wget file openssl pkgconf
  appmenu-gtk-module libappindicator-gtk3 librsvg xdotool
)

pacman_missing() {
  local p
  for p in "$@"; do pacman -Qq "$p" >/dev/null 2>&1 || printf '%s ' "$p"; done
}

check_pacman_packages() {
  local missing; missing=$(pacman_missing "${PACMAN_PACKAGES[@]}")
  [[ -z $missing ]] && { DETAIL="${#PACMAN_PACKAGES[@]} packages present"; return 0; }
  DETAIL="missing: $missing"
  return 1
}

install_pacman_packages() {
  # shellcheck disable=SC2046
  sudo pacman -S --needed --noconfirm $(pacman_missing "${PACMAN_PACKAGES[@]}")
}

install_cmake() { sudo pacman -S --needed --noconfirm cmake; }
platform_install_bluez() { sudo pacman -S --needed --noconfirm bluez bluez-utils; }
platform_install_mise() { sudo pacman -S --needed --noconfirm mise; }

check_webkit_driver() {
  command -v WebKitWebDriver >/dev/null || { DETAIL='needed only for end-to-end tests; built from source'; return 1; }
  DETAIL=$(command -v WebKitWebDriver)
  return 0
}
install_webkit_driver() { bash "$SETUP_ROOT/archlinux/install-webkit-webdriver.sh"; }

platform_install_unity_hub() {
  # Unity Hub is in the AUR (repackaged .deb); an AUR helper is required.
  local helper
  for helper in paru yay; do
    if command -v "$helper" >/dev/null; then "$helper" -S --needed --noconfirm unityhub; return; fi
  done
  fail 'No AUR helper (paru/yay) found. Install one, or build https://aur.archlinux.org/packages/unityhub manually.'
}

register_dependencies() {
  dep_add pacman   'Tauri system libraries (pacman)'  check_pacman_packages   install_pacman_packages
  dep_add cmake    'CMake (for liblsl)'               check_cmake             install_cmake
  dep_add mise     'mise (toolchain manager)'        check_mise              install_mise
  dep_add tools    'Toolchain pinned in mise.toml (bun, rust, uv)'  check_toolchain         install_toolchain
  dep_add bluez    'BlueZ + bluetooth.service'        check_bluetooth_service install_bluetooth_service
  dep_add udev     'Balance Board hidraw udev rule'   check_udev_rules        install_udev_rules
  dep_add group    'User in "input" group'            check_input_group       install_input_group
  dep_add tdriver  'tauri-driver (e2e tests)'         check_tauri_driver      install_tauri_driver  optional
  dep_add wdriver  'WebKitWebDriver (e2e tests, source build)' check_webkit_driver install_webkit_driver optional
  dep_add python   'Python streaming clients (scripts/, uv sync)' check_python_clients install_python_clients optional
  dep_add unity    'Unity Hub'                        check_unity_hub         install_unity_hub     optional
}
