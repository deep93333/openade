#!/usr/bin/env bash
set -euo pipefail
URL="${AGENTIDE_INSTALL_SCRIPT_URL:-https://raw.githubusercontent.com/deep93333/agentide/main/scripts/install.sh}"
curl -fsSL "$URL" | bash -s -- "$@"
