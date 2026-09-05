#!/usr/bin/env bash
# macOS dependencies. Sourced by setup/setup.sh.

check_xcode_clt() {
  xcode-select -p >/dev/null 2>&1 || { DETAIL='Xcode Command Line Tools not installed'; return 1; }
  DETAIL=$(xcode-select -p)
  return 0
}

install_xcode_clt() {
  xcode-select --install 2>/dev/null || true
  info 'Complete the Xcode Command Line Tools dialog, then press enter to continue.'
  read -r _
  xcode-select -p >/dev/null 2>&1 || fail 'Xcode Command Line Tools are still missing.'
}

check_brew() {
  command -v brew >/dev/null || { DETAIL='Homebrew not found'; return 1; }
  DETAIL="brew $(version_of brew --version)"
  return 0
}

install_brew() {
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  refresh_path
  post_note 'Homebrew was installed. Follow its "Next steps" output to add brew to your shell PATH.'
}

platform_install_mise() {
  command -v brew >/dev/null || fail 'Install Homebrew before mise.'
  brew install mise
}

install_cmake() {
  command -v brew >/dev/null || fail 'Install Homebrew before CMake.'
  brew install cmake
}

platform_install_unity_hub() {
  command -v brew >/dev/null || fail 'Install Homebrew before Unity Hub.'
  brew install --cask unity-hub
}

register_dependencies() {
  dep_add xcode    'Xcode Command Line Tools'         check_xcode_clt         install_xcode_clt
  dep_add brew     'Homebrew'                         check_brew              install_brew
  dep_add cmake    'CMake (for liblsl)'               check_cmake             install_cmake
  dep_add mise     'mise (toolchain manager)'        check_mise              install_mise
  dep_add tools    'Toolchain pinned in mise.toml (bun, rust, uv)'  check_toolchain         install_toolchain
  dep_add tdriver  'tauri-driver (no macOS WebDriver; CLI only)' check_tauri_driver install_tauri_driver optional
  dep_add python   'Python streaming clients (scripts/, uv sync)' check_python_clients install_python_clients optional
  dep_add unity    'Unity Hub'                        check_unity_hub         install_unity_hub     optional
}
