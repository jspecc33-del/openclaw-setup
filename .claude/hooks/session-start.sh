#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

PLUGIN_DIR="$CLAUDE_PROJECT_DIR/openclaw-code-agent"

# Install plugin devDependencies (TypeScript, @types/node)
if [ -f "$PLUGIN_DIR/package.json" ]; then
  echo "[session-start] Installing openclaw-code-agent dependencies..."
  npm install --prefix "$PLUGIN_DIR" --ignore-scripts
  echo "[session-start] Done."
fi
