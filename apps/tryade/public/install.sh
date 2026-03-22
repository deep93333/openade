#!/usr/bin/env bash
set -euo pipefail

REPO="${OPENADE_REPO:-${AGENTIDE_REPO:-https://github.com/deep93333/openade.git}}"
TARGET_DIR="${1:-openade}"

resolve_bun() {
  if command -v bun >/dev/null 2>&1; then
    command -v bun
    return 0
  fi
  local b
  for b in "${HOME}/.bun/bin/bun" "/opt/homebrew/bin/bun" "/usr/local/bin/bun"; do
    if [ -x "$b" ]; then
      printf "%s\n" "$b"
      return 0
    fi
  done
  return 1
}

ensure_bun() {
  local bun_path
  if bun_path="$(resolve_bun)"; then
    printf "%s\n" "$bun_path"
    return 0
  fi
  echo "Bun not found. Installing via https://bun.sh/install …" >&2
  curl -fsSL https://bun.sh/install | bash >/dev/null
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"
  if [ -x "$BUN_INSTALL/bin/bun" ]; then
    printf "%s\n" "$BUN_INSTALL/bin/bun"
    return 0
  fi
  echo "Bun install finished but bun was not found at $BUN_INSTALL/bin/bun. Open a new terminal and run this script again." >&2
  exit 1
}

check_node_for_vite() {
  command -v node >/dev/null 2>&1 || return 0
  local major
  major="$(node -p "parseInt(process.versions.node.split('.')[0],10)" 2>/dev/null || echo 0)"
  if [ "$major" -lt 20 ]; then
    echo "Node.js 20.19+ is required for the Vite app (you have $(node -v))." >&2
    echo "Install Node 22 LTS from https://nodejs.org/ or: brew install node@22" >&2
    echo "Then open a new terminal and run this script again (or run: cd \"$(pwd)\" && bun run dev)." >&2
    exit 1
  fi
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
check_node_for_vite
"$BUN" install
exec "$BUN" run dev
