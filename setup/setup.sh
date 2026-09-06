#!/usr/bin/env bash
# The Balance Toolkit development environment setup.
#
# Detects the platform, checks every dependency, and offers a checklist of the
# missing ones (all ticked by default) to install.
set -Eeuo pipefail

SETUP_ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd -- "$SETUP_ROOT/.." && pwd)
export SETUP_ROOT REPO_ROOT

usage() {
  printf '%s\n' \
    'Usage: setup/setup.sh [OPTIONS]        (or: mise run setup -- [OPTIONS])' \
    '       setup/setup.sh webdriver [OPTIONS]   (Arch only: build WebKitWebDriver)' \
    '' \
    'Check the development dependencies for The Balance Toolkit and install the' \
    'missing ones. Supports Ubuntu/Debian, Arch Linux, macOS and Windows (via' \
    'setup/setup.ps1, which this script forwards to under Git Bash / MSYS).' \
    '' \
    'Options:' \
    '  --check      Only report what is installed and what is missing.' \
    '  --yes, -y    Install the default selection without prompting.' \
    '  --all        Install everything missing, including optional items.' \
    '  --no-color   Disable colored output.' \
    '  -h, --help   Show this help.' \
    '' \
    'Run as your normal user; sudo is requested where needed.'
}

mode=interactive
select_optional=false
case "${1:-}" in
  webdriver) shift; exec bash "$SETUP_ROOT/archlinux/install-webkit-webdriver.sh" "$@" ;;
esac
for arg in "$@"; do
  case "$arg" in
    --check) mode=check ;;
    --yes|-y) mode=yes ;;
    --all) mode=yes; select_optional=true ;;
    --no-color) export NO_COLOR=1 ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown option: %s\n\n' "$arg" >&2; usage >&2; exit 2 ;;
  esac
done

# --- Platform detection -----------------------------------------------------
detect_platform() {
  case "$(uname -s)" in
    Darwin) echo macos; return ;;
    MINGW*|MSYS*|CYGWIN*) echo windows; return ;;
    Linux) ;;
    *) return 1 ;;
  esac
  [[ -r /etc/os-release ]] || return 1
  local ID= ID_LIKE=
  # shellcheck disable=SC1091
  . /etc/os-release
  local candidate
  for candidate in $ID $ID_LIKE; do
    case "$candidate" in
      arch|archlinux) echo archlinux; return ;;
      ubuntu|debian) echo ubuntu; return ;;
    esac
  done
  return 1
}

platform=$(detect_platform) || {
  printf 'Unsupported platform: %s. See INSTALL.md for manual instructions.\n' "$(uname -s)" >&2
  exit 1
}

if [[ $platform == windows ]]; then
  ps_args=()
  [[ $mode == check ]] && ps_args+=(-Check)
  [[ $mode == yes ]] && ps_args+=(-Yes)
  [[ $select_optional == true ]] && ps_args+=(-All)
  exec powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$SETUP_ROOT/setup.ps1" "${ps_args[@]}"
fi

# shellcheck disable=SC1091
. "$SETUP_ROOT/lib/common.sh"
# shellcheck disable=SC1091
. "$SETUP_ROOT/lib/checkbox.sh"
# shellcheck disable=SC1090
. "$SETUP_ROOT/$platform/deps.sh"

[[ $EUID -ne 0 ]] || fail 'Run this script as your normal user, without sudo.'
cd "$REPO_ROOT"
refresh_path
register_dependencies

# --- Check ----------------------------------------------------------------------
printf '%sThe Balance Toolkit setup%s · platform: %s\n\n' "$C_BOLD" "$C_RESET" "$platform"
info 'Checking dependencies'
dep_check_all
dep_report
printf '\n'

missing=()
for ((i = 0; i < ${#DEP_ID[@]}; i++)); do
  [[ ${DEP_OK[i]} == 0 ]] && missing+=("$i")
done

required_missing=0
for i in "${missing[@]:-}"; do
  [[ -n $i && ${DEP_KIND[i]} == required ]] && required_missing=$((required_missing + 1))
done

if ((${#missing[@]} == 0)); then
  ok 'Everything is installed.'
  exit 0
fi
if ((required_missing == 0)); then
  ok 'All required dependencies are installed. Only optional items are missing.'
fi
[[ $mode == check ]] && exit $((required_missing > 0))

# --- Select ---------------------------------------------------------------------
# rows[k] is the dependency index for row k, or -1 for a section header.
labels=() defaults=() rows=()
add_section() {  # add_section <kind> <title> <default-tick>
  local kind=$1 title=$2 tick=$3 i any=0
  for i in "${missing[@]}"; do [[ ${DEP_KIND[i]} == "$kind" ]] && any=1; done
  ((any)) || return 0
  labels+=("## $title"); defaults+=(0); rows+=(-1)
  for i in "${missing[@]}"; do
    [[ ${DEP_KIND[i]} == "$kind" ]] || continue
    labels+=("${DEP_LABEL[i]}"); defaults+=("$tick"); rows+=("$i")
  done
}
add_section required 'Required' 1
if [[ $select_optional == true ]]; then add_section optional 'Optional' 1; else add_section optional 'Optional' 0; fi

if [[ $mode == interactive ]]; then
  if [[ ! -t 0 || ! -t 1 ]]; then
    warn 'No interactive terminal. Rerun with --yes to install the default selection, or --check to only report.'
    exit 1
  fi
  info 'Select what to install'
  pick_items labels defaults || { warn 'Aborted. Nothing was installed.'; exit 1; }
else
  PICKED=("${defaults[@]}")
fi

selected=()
for ((k = 0; k < ${#rows[@]}; k++)); do
  [[ ${rows[k]} -ge 0 && ${PICKED[k]} == 1 ]] && selected+=("${rows[k]}")
done
if ((${#selected[@]} == 0)); then
  warn 'Nothing selected. Nothing was installed.'
  exit 0
fi

# --- Install --------------------------------------------------------------------
printf '\n'
failed=()
for i in "${selected[@]}"; do
  info "Installing: ${DEP_LABEL[i]}"
  if "${DEP_INSTALL[i]}"; then
    dep_check_one "$i"
    if [[ ${DEP_OK[i]} == 1 ]]; then ok "${DEP_LABEL[i]} ${C_DIM}${DEP_DETAIL[i]}${C_RESET}"
    else warn "${DEP_LABEL[i]}: installed, but the check still fails (${DEP_DETAIL[i]}). A new shell may be needed."; fi
  else
    bad "${DEP_LABEL[i]} failed to install"
    failed+=("$i")
  fi
  printf '\n'
done

# --- Summary --------------------------------------------------------------------
info 'Summary'
dep_check_all
dep_report
if ((${#POST_NOTES[@]} > 0)); then
  printf '\n'
  for note in "${POST_NOTES[@]}"; do warn "$note"; done
fi
if ((${#failed[@]} > 0)); then
  printf '\n'
  fail "${#failed[@]} item(s) failed. See INSTALL.md for manual steps."
fi
printf '\n'
ok 'Done. Next: cd apps/tauri && bun install && bun run tauri dev'
