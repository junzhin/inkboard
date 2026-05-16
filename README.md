# InkBoard

A browser canvas for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) that surfaces interactive flows in a real UI:

| Flow | Hook | Surface |
|------|------|---------|
| **Plan Review** | `PermissionRequest:ExitPlanMode` | Markdown viewer + inline annotations + multi-session tabs |
| **Structured Questions** | `PreToolUse:AskUserQuestion` | Multi-question form with options, custom input, auto-release |

When the server isn't running, all hooks fail silently — Claude Code falls back to its terminal defaults. Zero-friction install, zero breakage.

---

## Installation

### One-click (Claude Code plugin)

```bash
claude plugin install github:junzhin/inkboard
```

This clones the repo, builds server + web, and registers hooks automatically. The server auto-starts on first use.

### Manual

```bash
git clone https://github.com/junzhin/inkboard.git
cd inkboard
bash scripts/install.sh
bash scripts/start.sh
```

---

## How it works

```
Claude Code hook ──POST──▶ InkBoard server ──WS──▶ Browser canvas
                                 ▲                         │
                                 └────── WS answer ────────┘
```

1. Claude Code triggers a hook (e.g., `ExitPlanMode`).
2. Hook script POSTs to the local InkBoard server.
3. Server broadcasts to the browser canvas via WebSocket.
4. You review/annotate/answer in the browser.
5. Response flows back → hook returns result → Claude Code continues.

---

## Configuration

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `INKBOARD_PORT` | Auto (7777-7787) | Fixed port for the server |

### Settings (`hooks/hooks.json`)

```json
{
  "settings": {
    "questionRoutingEnabled": false
  }
}
```

- `questionRoutingEnabled: false` — questions stay in terminal (default)
- `questionRoutingEnabled: true` — questions route to canvas with 60s auto-release

You can also toggle this at runtime from the Home dashboard in the browser.

---

## Features

### Plan Review
- Markdown rendering with syntax highlighting
- Select text → Comment / Highlight / Delete
- Multi-session tabs (one per Claude Code window)
- Approve / Approve (auto-edit) / Request Changes
- Annotations sent back as structured feedback

### Structured Questions
- Radio options + custom text input
- 60-second canvas timeout → auto-releases to terminal
- "Answer in terminal" button for explicit fallback

### Home Dashboard
- Server connection status
- Pending reviews & questions count
- Question routing toggle
- Recent activity timeline

---

## Scripts

```bash
bash scripts/install.sh      # Install deps + build + configure hooks
bash scripts/start.sh        # Start server (or use lazy auto-start)
bash scripts/stop.sh         # Stop server
```

---

## Development

```bash
cd server && npm install && npm run build    # TypeScript → dist/
cd web && npm install && npm run dev          # Vite dev server (HMR)
cd server && npm test                        # Vitest
```

---

## Architecture

Two layers, decoupled:

- **Server** — Express + WebSocket, serves the SPA from `web/dist`
- **Web** — React + Zustand + Tailwind, connects via WebSocket

State is in-memory only. Server restart = lost pending interactions.

See [docs/architecture.md](docs/architecture.md) for component diagram and data flow.

---

## Docs

- [docs/architecture.md](docs/architecture.md) — Component diagram, data flow, state lifecycle
- [docs/hooks-setup.md](docs/hooks-setup.md) — Manual hook configuration
- [docs/api.md](docs/api.md) — HTTP endpoints + WebSocket message schema
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — Release history

---

## License

[MIT](LICENSE)
