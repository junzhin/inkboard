#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$PROJECT_DIR/server"
WEB_DIR="$PROJECT_DIR/web"
PID_FILE="/tmp/inkboard.pid"
PORT_FILE="/tmp/inkboard.port"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  PORT=$(cat "$PORT_FILE" 2>/dev/null || echo "16500")
  echo "[inkboard] Already running (PID $(cat "$PID_FILE"), port $PORT)"
  exit 0
fi

if [ ! -d "$SERVER_DIR/node_modules" ]; then
  echo "[inkboard] Installing server dependencies..."
  (cd "$SERVER_DIR" && npm install --production)
fi

if [ ! -d "$SERVER_DIR/dist" ]; then
  echo "[inkboard] Building server..."
  (cd "$SERVER_DIR" && npx tsc)
fi

if [ -d "$WEB_DIR" ] && [ ! -d "$WEB_DIR/dist" ] && [ -f "$WEB_DIR/package.json" ]; then
  echo "[inkboard] Building web UI..."
  (cd "$WEB_DIR" && npm install && npm run build)
fi

export INKBOARD_HOOKS_DIR="$SERVER_DIR/dist/hooks"

echo "[inkboard] Starting server..."
cd "$SERVER_DIR"
node dist/index.js &
SERVER_PID=$!

echo "[inkboard] Waiting for server readiness..."
for i in $(seq 1 10); do
  PORT=$(cat "$PORT_FILE" 2>/dev/null || echo "")
  if [ -n "$PORT" ] && curl -sf "http://localhost:$PORT/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "[inkboard] ERROR: Server failed to start"
  exit 1
fi

PORT=$(cat "$PORT_FILE" 2>/dev/null || echo "16500")
URL="http://localhost:$PORT"

# Export for Claude Code hooks to find the compiled hook scripts
echo "export INKBOARD_HOOKS_DIR=\"$SERVER_DIR/dist/hooks\"" > /tmp/inkboard.env

if command -v xdg-open &>/dev/null; then
  xdg-open "$URL" 2>/dev/null || true
elif command -v open &>/dev/null; then
  open "$URL" 2>/dev/null || true
fi

echo "[inkboard] Server running at $URL (PID $SERVER_PID)"
echo "[inkboard] To enable hooks, add to your shell profile:"
echo "  export INKBOARD_HOOKS_DIR=\"$SERVER_DIR/dist/hooks\""
