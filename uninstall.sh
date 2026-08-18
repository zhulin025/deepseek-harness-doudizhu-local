#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ $# -lt 1 ]]; then
  echo "Usage: ./uninstall.sh /path/to/deepseek-harness [--no-build]" >&2
  exit 1
fi
exec node "$SCRIPT_DIR/scripts/modify-harness.mjs" uninstall "$@"
