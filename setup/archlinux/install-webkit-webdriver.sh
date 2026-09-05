#!/usr/bin/env bash
set -Eeuo pipefail

# Adapted from https://gist.github.com/jamesmeneghello/37fc7988ec94edc962969ade428cd710
# Build only WebKitWebDriver; keep using the system's WebKitGTK libraries.

usage() {
  printf '%s\n' \
    'Usage: setup/setup.sh webdriver [OPTIONS]' \
    '' \
    'Build WebKitWebDriver for the installed Arch Linux webkit2gtk-4.1 version.' \
    'Uses the default compiler (honoring CC/CXX) and all CPUs reported by nproc.' \
    'Installs build dependencies with pacman and the driver into /usr/local/bin.' \
    'Run as your normal user; sudo is used only for dependency/binary installation.' \
    '' \
    'Options:' \
    '  --skip-dependencies  Use already-installed build dependencies.' \
    '  --build-only         Build and check the driver without installing it.' \
    '  -h, --help           Show this help.' \
    '' \
    'Build files are retained in a fresh temporary directory for troubleshooting.'
}

skip_dependencies=false
build_only=false
for argument in "$@"; do
  case "$argument" in
    --skip-dependencies) skip_dependencies=true ;;
    --build-only) build_only=true ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown option: %s\n' "$argument" >&2; usage >&2; exit 2 ;;
  esac
done

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

[[ $EUID -ne 0 ]] || fail 'Run this script as your normal user, without sudo.'
command -v pacman >/dev/null || fail 'This installer requires Arch Linux and pacman.'
pacman -Q webkit2gtk-4.1 >/dev/null 2>&1 || fail 'Install webkit2gtk-4.1 first.'

if [[ $skip_dependencies == false ]]; then
  sudo pacman -S --needed base-devel cmake ninja ruby ruby-stdlib gperf \
    python glib2-devel unifdef wayland-protocols curl xz
fi

for dependency in cmake ninja ruby gperf python pkg-config unifdef curl tar nproc mktemp; do
  command -v "$dependency" >/dev/null || fail "Missing build dependency: $dependency"
done
ruby -rgetoptlong -e '' || fail 'Ruby getoptlong is missing. Run: gem install --user-install getoptlong'

# Read after dependency installation, in case it changed the installed package.
package_info=$(pacman -Q webkit2gtk-4.1)
package_version=${package_info#* }
source_version=${package_version#*:}
source_version=${source_version%-*}
[[ $source_version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "Unexpected WebKitGTK version: $package_version"

driver_build_dir=$(mktemp -d "${TMPDIR:-/tmp}/webkit-driver.XXXXXX")
trap 'printf "Build failed at line %s. Files retained in: %s\n" "$LINENO" "$driver_build_dir" >&2' ERR

source_dir="$driver_build_dir/webkitgtk-$source_version"
build_dir="$driver_build_dir/build"
archive="$driver_build_dir/webkitgtk-$source_version.tar.xz"
jobs=$(nproc)

printf 'Building WebKitWebDriver %s with the default compiler and %s parallel jobs.\n' "$source_version" "$jobs"
printf 'Build directory: %s\n' "$driver_build_dir"
curl --fail --location --retry 3 \
  --output "$archive" "https://webkitgtk.org/releases/webkitgtk-$source_version.tar.xz"
tar -xf "$archive" -C "$driver_build_dir"

cmake -S "$source_dir" -B "$build_dir" -G Ninja \
  -DPORT=GTK \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX=/usr \
  -DCMAKE_INSTALL_LIBEXECDIR=lib \
  -DUSE_GTK4=OFF \
  -DENABLE_WEBDRIVER=ON \
  -DENABLE_DOCUMENTATION=OFF \
  -DENABLE_INTROSPECTION=OFF \
  -DENABLE_MINIBROWSER=OFF \
  -DENABLE_API_TESTS=OFF \
  -DENABLE_GAMEPAD=OFF \
  -DENABLE_SPEECH_SYNTHESIS=OFF \
  -DENABLE_VIDEO=OFF \
  -DENABLE_WEB_AUDIO=OFF \
  -DUSE_LIBBACKTRACE=OFF

cmake --build "$build_dir" --target WebKitWebDriver --parallel "$jobs"
driver="$build_dir/bin/WebKitWebDriver"
[[ -x $driver ]] || fail "Build did not produce an executable: $driver"
"$driver" --help

if [[ $build_only == true ]]; then
  printf '\nDriver built successfully: %s\n' "$driver"
  printf 'To use it: tauri-driver --native-driver %q\n' "$driver"
  exit 0
fi

# Do not install a driver for a different version if pacman ran during the build.
[[ $(pacman -Q webkit2gtk-4.1) == "$package_info" ]] || fail 'WebKitGTK changed during the build. Rerun the installer.'
sudo install -Dm755 "$driver" /usr/local/bin/WebKitWebDriver
/usr/local/bin/WebKitWebDriver --help
printf '\nInstalled /usr/local/bin/WebKitWebDriver. Start automation with: tauri-driver\n'
printf 'Build files retained in: %s\n' "$driver_build_dir"
