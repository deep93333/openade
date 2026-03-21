#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

run_bun() {
  if command -v bun >/dev/null 2>&1; then
    bun "$@"
  elif [ -x "${HOME}/.bun/bin/bun" ]; then
    "${HOME}/.bun/bin/bun" "$@"
  elif [ -x "/opt/homebrew/bin/bun" ]; then
    /opt/homebrew/bin/bun "$@"
  else
    return 1
  fi
}

if [[ "${1:-}" == "--install" ]]; then
  run_bun install || npm install
  shift
fi

if run_bun run dev; then
  exit 0
fi

echo "bun not found; trying npm run dev" >&2
npm run dev
