---
description: Start InkBoard canvas and begin structured interview
---

# InkBoard

Start the InkBoard canvas server and begin a structured requirements interview.

## Steps

1. Check if the InkBoard server is running by testing `http://localhost:7777/health`
2. If not running, start it:
   ```bash
   bash "$(dirname "$0")/../scripts/start.sh"
   ```
3. Wait 2 seconds for the server to initialize
4. Open the browser canvas (the start script handles this)
5. Begin the interview by invoking the `inkboard-interview` skill

## Fallback

If the server fails to start (port conflict, Node not available), proceed with the interview skill in terminal-only mode. The skill works without the canvas.
