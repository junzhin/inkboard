#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$PROJECT_DIR/server"
WEB_DIR="$PROJECT_DIR/web"
PID_FILE="/tmp/inkboard.pid"
PORT_FILE="/tmp/inkboard.port"
LOCK_FILE="/tmp/inkboard-start.lock"

open_browser() {
  local url="$1"
  if [ "${INKBOARD_NO_BROWSER:-0}" = "1" ]; then return; fi
  case "$(uname -s)" in
    Darwin)
      open "$url" 2>/dev/null || true
      ;;
    Linux)
      if command -v wslview >/dev/null 2>&1; then
        wslview "$url" 2>/dev/null || true
      elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$url" 2>/dev/null || true
      elif command -v cmd.exe >/dev/null 2>&1; then
        cmd.exe /c start "" "$url" 2>/dev/null || true
      fi
      ;;
    CYGWIN*|MINGW*|MSYS*)
      cmd /c start "" "$url" 2>/dev/null || true
      ;;
  esac
}

# Stale PID/PORT lock cleanup: PID file points to a dead process → wipe lockfiles.
if [ -f "$PID_FILE" ] && ! kill -0 "$(cat "$PID_FILE" 2>/dev/null)" 2>/dev/null; then
  echo "[inkboard] Cleaning stale PID/PORT/lock files (previous process is gone)"
  rm -f "$PID_FILE" "$PORT_FILE" "$LOCK_FILE"
fi

# Stale spawn lockfile: older than 1 min → orphan from crashed lazy-start.
if [ -f "$LOCK_FILE" ]; then
  if [ -z "$(find "$LOCK_FILE" -mmin -1 2>/dev/null)" ]; then
    rm -f "$LOCK_FILE"
  fi
fi

# Squatter scan: ports answering on 16500-16519 that are NOT inkboard get
# logged. findPort() in server/src/index.ts rolls past them via fingerprint,
# so no kill needed (preserves safety for legit dev tools). Opt-in active
# kill only via INKBOARD_KILL_SQUATTERS=1.
for p in $(seq 16500 16519); do
  body=$(curl -fsS --max-time 0.3 "http://127.0.0.1:$p/health" 2>/dev/null || true)
  if [ -z "$body" ]; then continue; fi
  if echo "$body" | grep -q '"app":"inkboard"'; then continue; fi
  echo "[inkboard] port $p has a non-inkboard squatter; server will skip via fingerprint" >&2
  if [ "${INKBOARD_KILL_SQUATTERS:-0}" = "1" ]; then
    pid=$(command -v lsof >/dev/null 2>&1 && lsof -ti ":$p" 2>/dev/null || true)
    if [ -n "$pid" ]; then
      echo "[inkboard] INKBOARD_KILL_SQUATTERS=1 → killing PID $pid on port $p" >&2
      kill "$pid" 2>/dev/null || true
    fi
  fi
done

# Already running? Verify via /health fingerprint, then surface URL + open browser.
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  PORT=$(cat "$PORT_FILE" 2>/dev/null || echo "")
  if [ -n "$PORT" ]; then
    body=$(curl -fsS --max-time 0.5 "http://127.0.0.1:$PORT/health" 2>/dev/null || true)
    if echo "$body" | grep -q '"app":"inkboard"'; then
      URL="http://localhost:$PORT"
      echo "[inkboard] Already running — $URL (PID $(cat "$PID_FILE"))"
      open_browser "$URL"
      exit 0
    fi
  fi
  echo "[inkboard] Stale PID but /health not inkboard — cleaning up and restarting"
  rm -f "$PID_FILE" "$PORT_FILE" "$LOCK_FILE"
fi

if [ ! -d "$SERVER_DIR/node_modules" ]; then
  echo "[inkboard] Installing server dependencies..."
  (cd "$SERVER_DIR" && npm install --production)
fi

if [ ! -f "$SERVER_DIR/dist/index.js" ]; then
  echo "[inkboard] Building server..."
  (cd "$SERVER_DIR" && npm run build)
fi

if [ -d "$WEB_DIR" ] && [ ! -f "$WEB_DIR/dist/index.html" ] && [ -f "$WEB_DIR/package.json" ]; then
  echo "[inkboard] Building web UI..."
  (cd "$WEB_DIR" && npm install && npm run build)
fi

export INKBOARD_HOOKS_DIR="$SERVER_DIR/dist/hooks"

echo "[inkboard] Starting server..."
cd "$SERVER_DIR"
node dist/index.js &
SERVER_PID=$!

echo "[inkboard] Waiting for server readiness..."
for i in $(seq 1 20); do
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

echo "export INKBOARD_HOOKS_DIR=\"$SERVER_DIR/dist/hooks\"" > /tmp/inkboard.env

# Server's openBrowser() at index.ts:191 already fires on cold spawn, so we
# don't re-open here to avoid double-pop. The "already running" branch above
# handles the re-open case for /inkboard on warm server.

echo "[inkboard] Server running at $URL (PID $SERVER_PID)"
echo "[inkboard] Hook scripts at: $SERVER_DIR/dist/hooks"
