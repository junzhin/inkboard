#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "[inkboard] Running post-install build..."

if [ ! -d "$PROJECT_DIR/server/node_modules" ]; then
  echo "[inkboard] Installing server dependencies..."
  (cd "$PROJECT_DIR/server" && npm install --production)
fi

echo "[inkboard] Building server..."
(cd "$PROJECT_DIR/server" && npx tsc)

if [ -f "$PROJECT_DIR/web/package.json" ]; then
  if [ ! -d "$PROJECT_DIR/web/node_modules" ]; then
    echo "[inkboard] Installing web dependencies..."
    (cd "$PROJECT_DIR/web" && npm install)
  fi

  echo "[inkboard] Building web UI..."
  (cd "$PROJECT_DIR/web" && npm run build)
fi

echo "[inkboard] Post-install complete. Server will auto-start on first hook trigger."
