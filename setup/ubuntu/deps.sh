#!/usr/bin/env bash
# Debian/Ubuntu dependencies. Sourced by setup/setup.sh.

APT_PACKAGES=(
  libwebkit2gtk-4.1-dev build-essential curl wget file pkg-config
  libxdo-dev libssl-dev libudev-dev libayatana-appindicator3-dev librsvg2-dev
)

apt_missing() {
  local p
  for p in "$@"; do dpkg-query -W -f='${Status}' "$p" 2>/dev/null | grep -q 'install ok installed' || printf '%s ' "$p"; done
}

check_apt_packages() {
  local missing; missing=$(apt_missing "${APT_PACKAGES[@]}")
  [[ -z $missing ]] && { DETAIL="${#APT_PACKAGES[@]} packages present"; return 0; }
  DETAIL="missing: $missing"
  return 1
}

install_apt_packages() {
  sudo apt-get update
  # shellcheck disable=SC2046
  sudo apt-get install -y $(apt_missing "${APT_PACKAGES[@]}")
}

install_cmake() { sudo apt-get install -y cmake; }
platform_install_bluez() { sudo apt-get install -y bluez; }
platform_install_mise() { curl -fsSL https://mise.run | sh; }

check_webkit_driver() {
  command -v WebKitWebDriver >/dev/null || { DETAIL='needed only for end-to-end tests'; return 1; }
  DETAIL=$(command -v WebKitWebDriver)
  return 0
}
install_webkit_driver() { sudo apt-get install -y webkit2gtk-driver; }

platform_install_unity_hub() {
  # Official Unity apt repository: https://docs.unity3d.com/hub/manual/InstallHub.html
  curl -fsSL https://hub.unity3d.com/linux/keys/public | gpg --dearmor | sudo tee /usr/share/keyrings/Unity_Technologies_ApS.gpg >/dev/null
  echo 'deb [signed-by=/usr/share/keyrings/Unity_Technologies_ApS.gpg] https://hub.unity3d.com/linux/repos/deb stable main' \
    | sudo tee /etc/apt/sources.list.d/unityhub.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y unityhub
}

register_dependencies() {
  dep_add apt      'Tauri system libraries (apt)'     check_apt_packages      install_apt_packages
  dep_add cmake    'CMake (for liblsl)'               check_cmake             install_cmake
  dep_add mise     'mise (toolchain manager)'        check_mise              install_mise
  dep_add tools    'Toolchain pinned in mise.toml (bun, rust, uv)'  check_toolchain         install_toolchain
  dep_add bluez    'BlueZ + bluetooth.service'        check_bluetooth_service install_bluetooth_service
  dep_add udev     'Balance Board hidraw udev rule'   check_udev_rules        install_udev_rules
  dep_add group    'User in "input" group'            check_input_group       install_input_group
  dep_add tdriver  'tauri-driver (e2e tests)'         check_tauri_driver      install_tauri_driver  optional
  dep_add wdriver  'WebKitWebDriver (e2e tests)'      check_webkit_driver     install_webkit_driver optional
  dep_add python   'Python streaming clients (scripts/, uv sync)' check_python_clients install_python_clients optional
  dep_add unity    'Unity Hub'                        check_unity_hub         install_unity_hub     optional
}
