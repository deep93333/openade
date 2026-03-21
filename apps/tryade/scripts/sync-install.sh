#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/../.." && pwd)"
ORIGIN="${TRYADE_ORIGIN:-https://tryade.sh}"
INSTALL_SRC="$REPO_ROOT/scripts/install.sh"
PUBLIC="$ROOT/public"
mkdir -p "$PUBLIC"
cp "$INSTALL_SRC" "$PUBLIC/install.sh"
chmod +x "$PUBLIC/install.sh"
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'set -euo pipefail' \
  "URL=\"\${AGENTIDE_INSTALL_SCRIPT_URL:-$ORIGIN/install.sh}\"" \
  'curl -fsSL "$URL" | bash -s -- "$@"' \
  > "$PUBLIC/i"
chmod +x "$PUBLIC/i"
