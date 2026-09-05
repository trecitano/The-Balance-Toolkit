#!/usr/bin/env bash
# Entry point kept at the repository root for convenience; the real setup lives in setup/.
exec bash "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/setup/setup.sh" "$@"
