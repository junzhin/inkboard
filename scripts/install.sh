#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "[inkboard] Installing server dependencies..."
(cd "$PROJECT_DIR/server" && npm install)

if [ -f "$PROJECT_DIR/web/package.json" ]; then
  echo "[inkboard] Installing web dependencies..."
  (cd "$PROJECT_DIR/web" && npm install)

  echo "[inkboard] Building web UI..."
  (cd "$PROJECT_DIR/web" && npm run build)
fi

echo "[inkboard] Building server..."
(cd "$PROJECT_DIR/server" && npx tsc)

echo "[inkboard] Installation complete!"
echo "Run 'bash $SCRIPT_DIR/start.sh' to start the server"
