#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/../.." && pwd)"
ORIGIN="${TRYADE_ORIGIN:-https://tryade.dev}"
INSTALL_SRC="$REPO_ROOT/scripts/install.sh"
PUBLIC="$ROOT/public"
mkdir -p "$PUBLIC"
cp "$INSTALL_SRC" "$PUBLIC/install.sh"
chmod +x "$PUBLIC/install.sh"
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'set -euo pipefail' \
  'if command -v npx >/dev/null 2>&1 && npx --yes openade "$@"; then' \
  '  exit 0' \
  'fi' \
  'echo "Using shell installer (no npx or CLI not on registry yet)…" >&2' \
  "URL=\"\${OPENADE_INSTALL_SCRIPT_URL:-\${AGENTIDE_INSTALL_SCRIPT_URL:-$ORIGIN/install.sh}}\"" \
  'curl -fsSL "$URL" | bash -s -- "$@"' \
  > "$PUBLIC/i"
chmod +x "$PUBLIC/i"
