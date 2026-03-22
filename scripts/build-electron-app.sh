#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Build Electron App
# @raycast.mode compact

# Optional parameters:
# @raycast.icon 🛠️
# @raycast.packageName Openade
# @raycast.needsConfirmation true

# Documentation:
# @raycast.description Build @openade/app with Electron mode
# @raycast.author dipmallakhani
# @raycast.authorURL https://github.com/dipmallakhani

set -euo pipefail

cd "/Users/dipmallakhani/Desktop/agentide"

if command -v bun >/dev/null 2>&1; then
  bun run --filter @openade/app build:electron
elif [ -x "/opt/homebrew/bin/bun" ]; then
  /opt/homebrew/bin/bun run --filter @openade/app build:electron
elif [ -x "$HOME/.bun/bin/bun" ]; then
  "$HOME/.bun/bin/bun" run --filter @openade/app build:electron
else
  npm run --workspace @openade/app build:electron
fi

echo "Electron app build complete"
