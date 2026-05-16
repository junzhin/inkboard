# Hooks setup

The InkBoard server is useless until Claude Code knows to route hook events to it.

## Automatic setup (recommended)

```bash
bash scripts/install.sh
```

This installs dependencies, builds server + web, and writes `.claude/settings.local.json` with the correct absolute paths. No manual configuration needed.

## Manual setup

### Option A — global settings

Edit `~/.claude/settings.json` and merge the InkBoard hooks block. Use absolute paths to the compiled hook entrypoints in `server/dist/hooks/`.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "AskUserQuestion",
        "hooks": [
          {
            "type": "command",
            "command": "node \"/abs/path/to/inkboard/server/dist/hooks/question-hook.js\" 2>/dev/null || true",
            "timeout": 120000
          }
        ]
      }
    ],
    "PermissionRequest": [
      {
        "matcher": "ExitPlanMode",
        "hooks": [
          {
            "type": "command",
            "command": "node \"/abs/path/to/inkboard/server/dist/hooks/plan-review-hook.js\" 2>/dev/null || true",
            "timeout": 345600000
          }
        ]
      }
    ]
  }
}
```

> Note: AskUserQuestion timeout must be ≥ 120s (canvas auto-release is 60s + buffer).

### Option B — project local

Drop the same block into `<project>/.claude/settings.local.json`. This applies only when Claude Code launches with `cwd` set inside that project.

> Pitfall: `.claude/settings.local.json` is read from `cwd`, not the git root. If you launch Claude from a sub-directory, the project-local settings won't load. Prefer global setup unless you have a specific reason.

## Question routing configuration

In `hooks/hooks.json`:

```json
{
  "settings": {
    "questionRoutingEnabled": false
  }
}
```

- `false` (default): questions stay in terminal, canvas is not involved.
- `true`: questions route to canvas; 60s auto-release falls back to terminal if unanswered.

You can also toggle at runtime via the switch on the Home dashboard.

## Verifying

1. Run `bash scripts/start.sh`, confirm `cat /tmp/inkboard.port` shows a port.
2. `curl http://localhost:$(cat /tmp/inkboard.port)/health` → `{"status":"ok"}`.
3. Trigger a debug plan review without involving Claude:
   ```bash
   curl http://localhost:$(cat /tmp/inkboard.port)/debug/push-plan-review
   ```
4. Reload the browser canvas (`http://localhost:$PORT/`). The plan should appear.
5. Click Approve / Request Changes. Toast confirms send. Server log shows the resolution.

For real-session verification, in Claude Code: enter Plan Mode → propose a plan → call `ExitPlanMode`. The browser canvas should pop up with the plan content.

## Hook fail-open behavior

Each hook entrypoint:
- Auto-allows / passes through if `/tmp/inkboard.pid` is missing (server not running).
- Auto-allows / passes through if the HTTP request to the server fails or times out.
- Logs to `/tmp/inkboard-*.log` for debugging.

So leaving the hooks wired up but the server stopped is safe — Claude Code falls back to its built-in terminal flow.
