#!/bin/bash
PID_FILE="/tmp/inkboard.pid"

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    echo "[inkboard] Server stopped (PID $PID)"
  else
    echo "[inkboard] Server not running (stale PID file)"
  fi
  rm -f "$PID_FILE"
else
  echo "[inkboard] No PID file found"
fi
