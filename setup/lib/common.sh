#!/usr/bin/env bash
# Shared helpers for the setup scripts. Compatible with bash 3.2 (macOS).

if [[ -t 1 && -z ${NO_COLOR:-} ]]; then
  C_RESET=$'\033[0m' C_BOLD=$'\033[1m' C_DIM=$'\033[2m'
  C_GREEN=$'\033[32m' C_RED=$'\033[31m' C_YELLOW=$'\033[33m' C_CYAN=$'\033[36m'
else
  C_RESET= C_BOLD= C_DIM= C_GREEN= C_RED= C_YELLOW= C_CYAN=
fi

info()  { printf '%s==>%s %s\n' "$C_CYAN" "$C_RESET" "$*"; }
ok()    { printf '  %s✔%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn()  { printf '  %s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*"; }
bad()   { printf '  %s✘%s %s\n' "$C_RED" "$C_RESET" "$*"; }
fail()  { printf '%sError:%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }

# Compare dotted versions: version_ge 1.10.2 1.9 -> true.
version_ge() {
  local IFS=. i a b
  set -f
  a=($1) b=($2)
  set +f
  for ((i = 0; i < ${#b[@]}; i++)); do
    local x=${a[i]:-0} y=${b[i]:-0}
    x=${x//[!0-9]/} y=${y//[!0-9]/}
    ((10#${x:-0} > 10#${y:-0})) && return 0
    ((10#${x:-0} < 10#${y:-0})) && return 1
  done
  return 0
}

# Extract the first x.y[.z] token from a command's output.
version_of() {
  "$@" 2>/dev/null | head -n1 | grep -Eo '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n1 || true
}

MISE_SHIMS="${MISE_DATA_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/mise}/shims"

# Make tools installed into the user's home visible to the rest of this run.
refresh_path() {
  [[ -r $HOME/.cargo/env ]] && . "$HOME/.cargo/env"
  [[ -d $HOME/.local/bin ]] && PATH="$HOME/.local/bin:$PATH"
  [[ -d $MISE_SHIMS ]] && PATH="$MISE_SHIMS:$PATH"
  [[ -d /opt/homebrew/bin ]] && PATH="/opt/homebrew/bin:$PATH"
  [[ -d /usr/local/bin ]] && PATH="/usr/local/bin:$PATH"
  export PATH
  hash -r 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Dependency registry. Each entry has an id, a label, a check function, an
# install function and a kind (required|optional). Check functions return 0
# when satisfied and may set DETAIL to a short human-readable note.
# ---------------------------------------------------------------------------
DEP_ID=() DEP_LABEL=() DEP_CHECK=() DEP_INSTALL=() DEP_KIND=() DEP_OK=() DEP_DETAIL=()
POST_NOTES=()

dep_add() {
  DEP_ID+=("$1"); DEP_LABEL+=("$2"); DEP_CHECK+=("$3"); DEP_INSTALL+=("$4")
  DEP_KIND+=("${5:-required}"); DEP_OK+=(0); DEP_DETAIL+=("")
}

post_note() { local IFS=$'\n'; POST_NOTES+=("$*"); }

dep_check_one() {
  local i=$1
  DETAIL=
  if "${DEP_CHECK[i]}"; then DEP_OK[i]=1; else DEP_OK[i]=0; fi
  DEP_DETAIL[i]=$DETAIL
}

dep_check_all() {
  local i
  for ((i = 0; i < ${#DEP_ID[@]}; i++)); do dep_check_one "$i"; done
}

dep_report() {
  local i tag
  for ((i = 0; i < ${#DEP_ID[@]}; i++)); do
    tag=
    [[ ${DEP_KIND[i]} == optional ]] && tag="${C_DIM}(optional)${C_RESET} "
    if [[ ${DEP_OK[i]} == 1 ]]; then
      ok "${DEP_LABEL[i]} $tag${C_DIM}${DEP_DETAIL[i]}${C_RESET}"
    else
      bad "${DEP_LABEL[i]} $tag${C_DIM}${DEP_DETAIL[i]:-missing}${C_RESET}"
    fi
  done
}

# Common checks shared by every platform ------------------------------------
# Bun and Rust are pinned in mise.toml at the repository root and installed by
# mise, so the versions are defined in one place for every platform.


check_mise() {
  command -v mise >/dev/null || { DETAIL='mise not found'; return 1; }
  DETAIL="mise $(version_of mise --version)"
  return 0
}

install_mise() {
  platform_install_mise
  refresh_path
  post_note 'mise was installed. Activate it in your shell so bun/cargo resolve automatically:' \
    '  bash:  echo '"'"'eval "$(mise activate bash)"'"'"' >> ~/.bashrc' \
    '  zsh:   echo '"'"'eval "$(mise activate zsh)"'"'"'  >> ~/.zshrc' \
    '  fish:  echo '"'"'mise activate fish | source'"'"'   >> ~/.config/fish/config.fish'
}

# Tools declared in the repository mise.toml that are not installed at the pinned version.
mise_missing_tools() {
  # mise abbreviates $HOME as ~ in the source column; accept both spellings.
  local cfg="$REPO_ROOT/mise.toml" cfg_tilde="~${REPO_ROOT#"$HOME"}/mise.toml"
  ( cd "$REPO_ROOT" && mise ls --missing 2>/dev/null ) \
    | awk -v a="$cfg" -v b="$cfg_tilde" 'index($0, a) || index($0, b) { printf "%s@%s ", $1, $2 }'
}

check_toolchain() {
  command -v mise >/dev/null || { DETAIL='needs mise'; return 1; }
  local missing; missing=$(mise_missing_tools)
  if [[ -n $missing ]]; then DETAIL="missing or outdated: $missing"; return 1; fi
  DETAIL="bun $(cd "$REPO_ROOT" && mise current bun 2>/dev/null), rust $(cd "$REPO_ROOT" && mise current rust 2>/dev/null)"
  return 0
}

install_toolchain() {
  command -v mise >/dev/null || fail 'Install mise before the toolchain.'
  ( cd "$REPO_ROOT" && mise trust --quiet mise.toml && mise install --yes )
  refresh_path
}

check_cmake() {
  command -v cmake >/dev/null || { DETAIL='cmake not found'; return 1; }
  DETAIL="cmake $(version_of cmake --version)"
  return 0
}

check_tauri_driver() {
  command -v tauri-driver >/dev/null || { DETAIL='needed only for end-to-end tests'; return 1; }
  DETAIL=$(command -v tauri-driver)
  return 0
}

install_tauri_driver() {
  command -v mise >/dev/null || fail 'Install mise and the toolchain before tauri-driver.'
  ( cd "$REPO_ROOT" && mise exec -- cargo install tauri-driver --locked )
}

# Optional: Python streaming clients in scripts/ ------------------------------
check_python_clients() {
  local venv="$REPO_ROOT/scripts/.venv"
  [[ -x $venv/bin/python || -x $venv/Scripts/python.exe ]] || { DETAIL='scripts/.venv not created (uv sync)'; return 1; }
  command -v mise >/dev/null && ( cd "$REPO_ROOT/scripts" && mise exec -- uv sync --locked --check >/dev/null 2>&1 ) \
    || { DETAIL='scripts/.venv is out of date with uv.lock'; return 1; }
  DETAIL="scripts/.venv, python $(cat "$REPO_ROOT/scripts/.python-version")"
  return 0
}

install_python_clients() {
  command -v mise >/dev/null || fail 'Install mise and the toolchain first (they provide uv).'
  ( cd "$REPO_ROOT/scripts" && mise exec -- uv sync --locked )
}

# Optional: Unity Hub -----------------------------------------------------------
check_unity_hub() {
  if command -v unityhub >/dev/null; then DETAIL=$(command -v unityhub); return 0; fi
  if [[ -d "/Applications/Unity Hub.app" ]]; then DETAIL='/Applications/Unity Hub.app'; return 0; fi
  DETAIL='not installed; Unity Editors are then installed from the Hub'
  return 1
}

install_unity_hub() {
  platform_install_unity_hub
  post_note 'Unity Hub was installed. Open it, sign in, and install the Editor version your Unity project needs.'
}

# Linux-only helpers ---------------------------------------------------------
UDEV_RULE_NAME=99-nintendo-hidraw.rules

check_udev_rules() {
  local src="$REPO_ROOT/linux/$UDEV_RULE_NAME" dst="/etc/udev/rules.d/$UDEV_RULE_NAME"
  [[ -r $dst ]] || { DETAIL="$dst not installed"; return 1; }
  cmp -s "$src" "$dst" || { DETAIL="$dst differs from linux/$UDEV_RULE_NAME"; return 1; }
  DETAIL="$dst"
  return 0
}

install_udev_rules() {
  sudo install -m644 "$REPO_ROOT/linux/$UDEV_RULE_NAME" "/etc/udev/rules.d/$UDEV_RULE_NAME"
  sudo udevadm control --reload
  sudo udevadm trigger --subsystem-match=hidraw
}

check_input_group() {
  local g
  for g in $(id -nG); do [[ $g == input ]] && { DETAIL="$USER is in the input group"; return 0; }; done
  DETAIL="$USER is not in the input group"
  return 1
}

install_input_group() {
  sudo usermod -aG input "$USER"
  post_note 'You were added to the "input" group. Log out and back in for hidraw access to take effect.'
}

check_bluetooth_service() {
  command -v bluetoothctl >/dev/null || { DETAIL='bluez not installed'; return 1; }
  if command -v systemctl >/dev/null; then
    systemctl is-enabled bluetooth >/dev/null 2>&1 || { DETAIL='bluetooth.service is not enabled'; return 1; }
  fi
  DETAIL='bluez installed, bluetooth.service enabled'
}

install_bluetooth_service() {
  platform_install_bluez
  if command -v systemctl >/dev/null; then
    sudo systemctl enable --now bluetooth
  fi
}
