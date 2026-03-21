#!/usr/bin/env bash
set -euo pipefail

REPO="${AGENTIDE_REPO:-https://github.com/deep93333/agentide.git}"
TARGET_DIR="${1:-agentide}"

resolve_bun() {
  if command -v bun >/dev/null 2>&1; then
    command -v bun
    return 0
  fi
  local b
  for b in "${HOME}/.bun/bin/bun" "/opt/homebrew/bin/bun" "/usr/local/bin/bun"; do
    if [ -x "$b" ]; then
      echo "$b"
      return 0
    fi
  done
  return 1
}

ensure_bun() {
  local bun_path
  if bun_path="$(resolve_bun)"; then
    echo "$bun_path"
    return 0
  fi
  echo "Bun not found. Installing via https://bun.sh/install …" >&2
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"
  if [ -x "$BUN_INSTALL/bin/bun" ]; then
    echo "$BUN_INSTALL/bin/bun"
    return 0
  fi
  echo "Bun install finished but bun was not found at $BUN_INSTALL/bin/bun. Open a new terminal and run this script again." >&2
  exit 1
}

if ! command -v git >/dev/null 2>&1; then
  echo "git is required. Install Git and retry." >&2
  exit 1
fi

DEST="$(pwd)/$TARGET_DIR"
if [ -e "$DEST" ] && [ ! -d "$DEST/.git" ]; then
  echo "Path exists and is not a clone: $DEST" >&2
  exit 1
fi

if [ ! -d "$DEST" ]; then
  git clone --depth 1 "$REPO" "$DEST"
elif [ -d "$DEST/.git" ]; then
  git -C "$DEST" pull --ff-only || true
fi

cd "$DEST"
BUN="$(ensure_bun)"
"$BUN" install
exec "$BUN" run dev
