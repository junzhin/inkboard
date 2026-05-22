<p align="center">
  <img src="assets/logo.svg" alt="InkBoard" width="96" height="96" />
</p>

<h1 align="center">InkBoard</h1>

<p align="center">
  <a href="https://github.com/junzhin/inkboard/releases">
    <img alt="Version" src="https://img.shields.io/badge/version-0.3.2-1f2937?style=for-the-badge" />
  </a>
  <a href="LICENSE">
    <img alt="License" src="https://img.shields.io/badge/license-MIT-2563eb?style=for-the-badge" />
  </a>
  <img alt="Platform" src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20WSL%20%7C%20Windows-7c3aed?style=for-the-badge" />
  <img alt="Claude Code" src="https://img.shields.io/badge/Claude%20Code-plugin-d97706?style=for-the-badge" />
</p>

<p align="center">
  <a href="https://github.com/junzhin/inkboard">
    <img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=24&pause=1200&color=2563EB&center=true&vCenter=true&multiline=false&width=720&height=44&lines=See+what+Claude+thinks.+Before+it+ships.;A+browser+canvas+for+Claude+Code+plans.;Review+%E2%80%A2+Annotate+%E2%80%A2+Approve+%E2%80%94+in+a+real+UI.;Multi-session+%E2%80%A2+Dark+mode+%E2%80%A2+%E4%B8%AD%E6%96%87+%26+English.;Zero+lock-in.+Toggle+off%2C+falls+back+to+terminal." alt="InkBoard tagline" />
  </a>
</p>

<p align="center">
  <strong>Stop reading 200-line refactor plans in a terminal wall of text.</strong><br/>
  Push them to a browser canvas with syntax highlighting, inline annotations, and multi-session tabs — then approve, reject, or request changes with one click.
</p>

<p align="center">
  <a href="#-installation">Install</a> &nbsp;·&nbsp;
  <a href="#-features">Features</a> &nbsp;·&nbsp;
  <a href="#-how-it-works">How it works</a> &nbsp;·&nbsp;
  <a href="#-screenshots">Screenshots</a> &nbsp;·&nbsp;
  <a href="docs/architecture.md">Architecture</a>
</p>

---

## ✨ What you get

| Flow | Hook | Surface |
|------|------|---------|
| **Plan Review** | `PreToolUse:ExitPlanMode` + `PermissionRequest:ExitPlanMode` | Markdown viewer · inline annotations · multi-session tabs · approve / request-changes |
| **Structured Questions** | `PreToolUse:AskUserQuestion` | Multi-question form · radio + custom input · multi-session tabs · "answer in terminal" escape hatch |
| **Home Dashboard** | — | Live `/health` banner · pending counts · routing toggle · activity timeline |

Zero-friction install. **Zero breakage** — when the server isn't running, hooks fail silently and Claude Code falls back to its terminal defaults.

---

## 📸 Screenshots

> Placeholder section — drop PNGs into `assets/screenshots/` to populate.

<p align="center">
  <img src="assets/screenshots/home.png" alt="Home dashboard" width="80%" />
  <br/><em>Home dashboard — connection status, pending reviews & questions, recent activity timeline.</em>
</p>

<p align="center">
  <img src="assets/screenshots/review.png" alt="Plan review canvas" width="80%" />
  <br/><em>Plan Review — Markdown rendering, inline annotations, multi-session tabs.</em>
</p>

<p align="center">
  <img src="assets/screenshots/question.png" alt="Question canvas" width="80%" />
  <br/><em>Structured Questions — radio options with optional custom text.</em>
</p>

---

## 🤔 Why InkBoard?

Claude Code writes plans in markdown. You read them in a terminal. That's fine for small changes — but for a 200-line refactoring plan, you want:

- **Visual context** — syntax-highlighted markdown, not raw text
- **Inline annotations** — select text → comment / highlight / mark-for-deletion
- **Multi-session** — review plans from multiple Claude windows in one place, with per-session tabs
- **Structured answers** — answer Claude's questions with radio buttons, not freeform text
- **Dark mode + 中文** — UI in light or dark, English or Chinese, persisted across sessions
- **No lock-in** — toggle off anytime, every flow falls back to terminal

InkBoard is the missing UI layer between Claude's thinking and your approval.

---

## 🚀 Installation

### One-click (Claude Code plugin)

Inside a Claude Code session:

```
/plugin marketplace add junzhin/inkboard
/plugin install inkboard@inkboard
```

That's it. Pre-built artifacts ship in the repo, so no `npm install` / build step is required. The server **auto-starts** the first time Claude triggers a hook — no background process to manage.

### Manual (development / from source)

```bash
git clone https://github.com/junzhin/inkboard.git
cd inkboard
bash scripts/install.sh   # installs deps + builds server/dist + web/dist
bash scripts/start.sh
```

### Re-install / upgrade

Claude Code caches the marketplace clone separately from the install cache, so a stale version can stick around even after `/plugin uninstall`. The one-shot cleanup:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/junzhin/inkboard/main/scripts/uninstall.sh)
```

Then in Claude Code:

```
/plugin marketplace add junzhin/inkboard
/plugin install inkboard@inkboard
```

Pass `--purge` to also wipe `~/.config/inkboard/` (your saved settings).

---

## ⚙️ How it works

```
Claude Code hook ──POST──▶ InkBoard server ──WS──▶ Browser canvas
                                 ▲                         │
                                 └────── WS answer ────────┘
```

1. Claude Code triggers a hook (e.g., `ExitPlanMode`).
2. Hook script POSTs to the local InkBoard server.
3. Server broadcasts to the browser canvas via WebSocket.
4. You review / annotate / answer in the browser.
5. Response flows back → hook returns result → Claude Code continues.

### First time you trigger a hook

1. The server **auto-starts** in the background (no `npm install` needed — dependencies are bundled).
2. Your default browser **auto-opens** `http://localhost:<port>` to the InkBoard canvas.
3. Claude Code shows a hint in the terminal:
   ```
   [inkboard] Plan review sent to canvas → http://localhost:16500
   ```
   If the browser didn't open automatically (headless / remote / `INKBOARD_NO_BROWSER=1`), click the URL or open it manually.
4. Approve / annotate / deny in the browser. Claude Code continues with your decision.

For **plan review** (`ExitPlanMode`), the server waits up to **20 seconds** for the browser to connect (covers cold-start across platforms). The plan is registered up-front, so a freshly-opening canvas always picks it up via the replay-on-connect channel. If those 20 seconds elapse with no client, the hook auto-allows and prints a one-line hint pointing to the URL.

> **Heads-up on the native ExitPlanMode prompt** — since v0.2.8 the plan push runs in `PreToolUse:ExitPlanMode`, which has no native UI racing with it. The `PermissionRequest:ExitPlanMode` hook only auto-suppresses the native prompt when a fresh per-session approval marker exists (set by the canvas decision). If the server is unreachable, the marker isn't written and Claude Code's native prompt handles the request — no silent auto-approvals.

For **questions** (`AskUserQuestion`), the canvas is on by default (`questionRoutingEnabled: true`). Toggle off from the Home dashboard to keep questions in the terminal picker.

---

## 🔧 Configuration

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `INKBOARD_PORT` | Auto (16500–16519) | Fixed port for the server. The default range avoids known squatters on macOS (Code Helper, Edge DevTools) and binds IPv4 only so `localhost` lookup is unambiguous. |
| `INKBOARD_NO_BROWSER` | unset | Set to `1` to disable auto-open browser on server start (useful for headless / remote setups). |
| `INKBOARD_KILL_SQUATTERS` | unset | Set to `1` to let `scripts/start.sh` reclaim port-range squatters on startup. Off by default — start.sh only logs them. |

### Settings

Two files participate; user-level wins:

1. `hooks/hooks.json` (bundled with the plugin — treat as factory defaults; gets overwritten on every plugin update)
2. `~/.config/inkboard/config.json` (your overrides — survives plugin updates)

```json
{
  "settings": {
    "questionRoutingEnabled": true
  }
}
```

- `questionRoutingEnabled: true` — questions route to canvas (default)
- `questionRoutingEnabled: false` — questions stay in terminal

Toggling from the Home dashboard writes to (2). The plugin update path never touches (2).

---

## 🎯 Features

### Plan Review
- Markdown rendering with syntax highlighting
- Select text → Comment / Highlight / Mark for deletion
- Multi-session tabs (one per Claude Code window)
- Approve / Approve (auto-edit) / Request Changes
- Annotations sent back as structured feedback

### Structured Questions
- Radio options + custom text input
- Multi-session tabs — concurrent sessions never overwrite each other
- "Answer in terminal" button for explicit fallback

### Home Dashboard
- Live `/health` connection status (port · pid · version)
- Pending reviews & questions counts
- Question routing toggle
- Recent activity timeline (last 12 events)

### Quality-of-life
- **Dark mode** (CSS variable swap — `prefers-color-scheme` on first visit, then persisted)
- **i18n** — English / 中文 toggle in header, persisted
- **Auto-start** — server lazy-spawns on first hook, no daemon to manage
- **Auto-open browser** — canvas URL pops open on cold start
- **Replay on reconnect** — pending items re-broadcast when a client connects mid-flight

---

## 📜 Scripts

```bash
bash scripts/install.sh      # Install deps + build + configure hooks
bash scripts/start.sh        # Start server (or noop if already healthy + re-open browser)
bash scripts/stop.sh         # Stop server
bash scripts/uninstall.sh    # Wipe marketplace + cache + /tmp/inkboard.*
```

---

## 🛠 Development

```bash
cd server && npm install && npm run build    # esbuild bundle → server/dist
cd web && npm install && npm run dev         # Vite dev server with HMR
cd server && npm test                        # Vitest (10 tests)
```

---

## 🏗 Architecture

Two layers, decoupled:

- **Server** — Express + WebSocket, serves the SPA from `web/dist`
- **Web** — React + Zustand + Tailwind, connects via WebSocket

State is in-memory only. Server restart = lost pending interactions. Single-user, single-machine — binds to `127.0.0.1` only.

See [docs/architecture.md](docs/architecture.md) for component diagram and data flow.

---

## 📚 Docs

- [docs/architecture.md](docs/architecture.md) — Component diagram, data flow, state lifecycle
- [docs/hooks-setup.md](docs/hooks-setup.md) — Manual hook configuration
- [docs/api.md](docs/api.md) — HTTP endpoints + WebSocket message schema
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — Release history

---

## 📄 License

[MIT](LICENSE)
