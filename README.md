# InkBoard

Browser canvas for Claude Code that surfaces two interactive flows in a real UI:

| Flow                         | Trigger                                  | Browser surface                                    |
| ---------------------------- | ---------------------------------------- | -------------------------------------------------- |
| **Question (AskUserQuestion)** | `PreToolUse:AskUserQuestion` hook        | Multi-question form, returns answers via WebSocket |
| **Plan review (ExitPlanMode)** | `PermissionRequest:ExitPlanMode` hook    | Markdown render + text-selection annotations + multi-session tabs |

The **Home** surface shows server status, pending counts, active reviews, and a session activity timeline.

Two layers, decoupled:

- **Server** — Express + WebSocket on `:7777-:7787` (first free port wins)
- **Web** — React + Vite SPA served from `web/dist`

If the server isn't running, all hooks fail silently and Claude Code falls back to its terminal default. No setup error.

---

## Quick start

```bash
bash scripts/install.sh        # install + build + auto-configure Claude Code hooks
bash scripts/start.sh          # start server, open browser
```

The install script writes `.claude/settings.local.json` with the correct hook paths. No manual configuration needed.

The server writes its port to `/tmp/inkboard.port` and PID to `/tmp/inkboard.pid`.

**Question routing** is OFF by default (questions stay in terminal). Toggle ON in the browser Home page to route `AskUserQuestion` to the canvas. When enabled, a 60-second auto-release timer falls back to terminal if unanswered.

For manual hook setup, see [docs/hooks-setup.md](docs/hooks-setup.md).

---

## Repo layout

```
.
├── server/        # Express + WS + hook entrypoints (TypeScript)
├── web/           # React + Vite browser canvas
├── skills/        # inkboard-interview SKILL.md (5-phase requirements interview)
├── commands/      # /inkboard slash command
├── hooks/         # hooks.json template for Claude Code
├── scripts/       # install / start / stop bash helpers
└── docs/          # architecture, hooks setup, API reference
```

---

## Docs

- [docs/architecture.md](docs/architecture.md) — component diagram, data flow, state lifecycle
- [docs/hooks-setup.md](docs/hooks-setup.md) — wiring `~/.claude/settings.json`
- [docs/api.md](docs/api.md) — HTTP endpoints + WebSocket message schema
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — release history

For Claude Code itself, see [CLAUDE.md](CLAUDE.md).
