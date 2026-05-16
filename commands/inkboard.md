---
description: Start InkBoard canvas and begin structured interview
---

# InkBoard

Start the InkBoard canvas server and begin a structured requirements interview.

## Steps

1. Read `/tmp/inkboard.port` (created by the server). Probe `http://localhost:$PORT/health`.
2. If unreachable, start the server:
   ```bash
   bash "$(dirname "$0")/../scripts/start.sh"
   ```
3. Wait for `/tmp/inkboard.port` to appear, then open `http://localhost:$PORT`.
4. Invoke the `inkboard-interview` skill.

The server probes ports 7777-7787 in order; first free port wins.

## Fallback

If the server fails to start, proceed with the `inkboard-interview` skill in terminal-only mode. The skill works without the canvas.
