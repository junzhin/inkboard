# CLAUDE.md

Guidance for Claude Code agents working in this repo.

## Project

InkBoard is a browser canvas that surfaces two Claude Code flows in a real UI: AskUserQuestion and ExitPlanMode plan review. Server pushes events via WebSocket to a React SPA; SPA pushes decisions back the same way. A Home dashboard summarizes server status, pending counts, active reviews, and a recent-activity timeline.

## Architecture (one-liner)

```
Claude Code hook → POST /hooks/* → state.add* (Promise) → WS broadcast → React canvas
                                          ↑
React canvas → WS plan-review-decision/answer → state.resolve* → HTTP response → hook stdout → Claude
```

State lives in-memory only (`server/src/state.ts`). Server restart = lost pending interactions.

## Build & run

```bash
cd server && npm run build         # tsc → server/dist
cd web    && npm run build         # tsc + vite → web/dist
bash scripts/start.sh              # writes /tmp/inkboard.{pid,port}
bash scripts/stop.sh
```

Tests: `cd server && npm test` (vitest, 10 tests).

## When you edit

- **Adding a flow** = new hook entrypoint in `server/src/hooks/` + new route in `server/src/routes/` + new ServerMessage variant in `types.ts` (both server + web) + new handler in `web/src/App.tsx` + new component in `web/src/components/` + new store action in `web/src/store.ts`.
- **Server `types.ts` and web `types.ts` must stay in sync** — there's no shared package, just two parallel files. If you add a field, edit both.
- **WS message contract** is the integration point. Don't break it without bumping schema in both places.
- **Hook stdout is the protocol back to Claude Code.** `PreToolUse` hooks return `{decision: "block", reason}` to block, empty to pass. `PermissionRequest` returns `{hookSpecificOutput: {hookEventName, decision: {behavior: "allow" | "deny", message?}}}`.

## Codebase rules

- No `any`. No `console.log` in production paths (debug logging via `[inkboard]` prefix in entrypoints OK).
- Immutable Zustand updates: `set((s) => ({...}))`, never mutate `s.*` in place.
- `position: fixed` toolbars use viewport coords (no `scrollY` offset).
- Headless verification: `chrome.exe --headless --dump-dom http://localhost:$PORT/?test=plan` reads `web/dist` and confirms render.
- **Server binds IPv4 only** (`127.0.0.1`) and uses port range 16500–16519. Do not change to `0.0.0.0` or to a different port band without confirming there are no LISTEN squatters on the new band on macOS.
- **`/health` fingerprint contract**: payload must include `app: "inkboard"`, `version`, `pid`, `port`. Hook bridge and canvas both check `app === "inkboard"` to detect port squatters. Don't rename the field.
- **Hook bridge fast path** (`hook-bridge.ts`): PID alive + `PORT_FILE` mtime < 5 min ⇒ skip `/health` round-trip. Server heartbeat touches `PORT_FILE` every 60 s so the trust window never expires while the server is running.
- **Plan review uses two hooks**: `PreToolUse:ExitPlanMode` (`plan-push-hook.ts`) pushes the plan to canvas and blocks Claude until the user decides. On canvas approve it writes `/tmp/inkboard-plan-approved-<session_id>` as a one-shot marker. `PermissionRequest:ExitPlanMode` (`plan-review-hook.ts`) auto-allows ONLY when the marker is present + fresh (< 60 s); otherwise returns empty `{}` so Claude Code's native UI handles the request. This prevents silent auto-approval when the canvas push fails (server down).
- **User config lives at `~/.config/inkboard/config.json`** (XDG). `hooks/hooks.json` inside the marketplace clone is *factory defaults only* — gets overwritten on `git pull`. Anything that needs to persist across plugin updates must go through `server/src/config.ts` `saveUserConfig()`.

## Known limits

- **Approve (auto-edit)** sends a hint via the deny `message` field, but Claude Code's `PermissionRequest` decision schema does not actually toggle auto-edit mode for subsequent file edits. The button is honest about its intent; whether downstream tooling honors it is out of scope.
- **Native UI race (mitigated in v0.2.8)**: PermissionRequest hooks run concurrently with Claude Code's native ExitPlanMode UI. v0.2.8 sidesteps this by moving plan push + decision blocking to `PreToolUse:ExitPlanMode` (no native UI race), with `PermissionRequest` hook auto-allowing instantly to suppress the native prompt. The plan content heuristic reads the most-recently-modified `.claude/plans/*.md` file when `tool_input.plan` is empty.
- **Plan content heuristic**: `plan-push-hook` tries `tool_input.plan` first (populated for some Claude Code versions). Falls back to mtime-based `.claude/plans/*.md` scan. Single active plan per session makes this reliable; concurrent sessions in the same cwd are an edge case.
- **No persistence**: pending reviews lost on server restart.
- **Single-user, single-machine**: no auth, binds to localhost only.

## What NOT to do

- Don't reintroduce `plan-snapshot` / `MarkdownReview` / `UserPromptSubmit` plumbing — removed because Plan Review supersedes it.
- Don't reintroduce per-Edit/Write diff gating (`hook-diff` / `DiffReview`) — removed because per-hunk approval added high friction without strategic value; Plan Review covers the strategic case.
- Don't bypass `state.add*` and broadcast directly; replay-on-reconnect won't work.
- Don't add state mutations or Promise wrappers for things that should be transient UI state.

## Changelog

### 2026-05-21 (v0.3.1)

- **Question routing — no more silent drops.** Removed `!hasClients()` short-circuit and 60 s canvas-release timer from `server/src/routes/hook-question.ts`. `state.addQuestion()` now registers synchronously **before** the broadcast, so a client connecting mid-flight picks it up via `replayPendingItems()`. As long as the routing toggle is ON, every AskUserQuestion call waits for the canvas; the only fallback path is the 5-minute hook timeout. Manual "↳ Answer in terminal" button still releases on demand.
- **Plan auto-approve bug fixed.** `plan-review-hook.ts` (`PermissionRequest:ExitPlanMode`) used to auto-allow unconditionally, which silently bypassed both canvas and native UI when the PreToolUse plan-push failed (server unreachable, lazy-start failure). Now it gates on a per-session marker (`/tmp/inkboard-plan-approved-<session_id>`) written by `plan-push-hook.ts` only on a successful canvas-approve. No marker → return empty `{}` → native UI takes over. One-shot marker (deleted on read) so it can't leak between requests.
- **`/inkboard` always lands the user on the canvas.** `scripts/start.sh` now wipes stale PID/PORT/lock files when the recorded PID is dead, logs non-inkboard squatters on 16500–16519 (active kill opt-in via `INKBOARD_KILL_SQUATTERS=1`), and — when an inkboard instance is already healthy — prints `Already running — http://localhost:PORT` and re-opens the browser tab (WSL, macOS, native Linux, Windows). Cold-spawn browser-open stays in `server/src/index.ts:openBrowser` to avoid double-pop.
- **Question countdown removed.** `QuestionCanvas.tsx` no longer renders the 60 s timer; the manual "↳ Answer in terminal" release button stays.

### 2026-05-20 (v0.3.0)

- **Dark mode.** CSS custom property-based theme system. All Tailwind color tokens (`paper-*`, `ink-*`, `ochre-*`, `moss-*`, `rust-*`) and box shadows defined as CSS variables in `:root` (light) and `.dark` (dark). Toggle in header persists to localStorage; respects `prefers-color-scheme` on first visit. Zero component Tailwind class changes — dark mode works entirely via variable swap.
- **Chinese i18n.** ~63 UI string keys extracted to `web/src/lib/i18n.ts` with `en` and `zh` translations. `t("key")` function used in all 4 components. Toggle in header (EN/中) persists to localStorage. Falls back to `navigator.language` on first visit.
- **Auto-start path fix.** `commands/inkboard.md` now uses `${CLAUDE_PLUGIN_ROOT}/scripts/start.sh` instead of broken `$(dirname "$0")/../scripts/start.sh`. Port range docs updated 7777→16500. `start.sh` checks `dist/index.js` (not just `dist/`) and runs `npm run build` instead of raw `npx tsc`.

### 2026-05-20 (v0.2.9)

- **Multi-session question tabs.** Questions now use the same array + tab pattern as plan reviews. Multiple Claude Code sessions can ask questions simultaneously without overwriting each other. Frontend-only change — zero server/hook/WS protocol modifications.

### 2026-05-19 (v0.2.8)

- **Plan review bypasses native UI race entirely.** New `PreToolUse:ExitPlanMode` hook (`plan-push-hook.ts`) pushes plan to canvas and blocks Claude until canvas decision — same protocol as AskUserQuestion, no competing native UI. `PermissionRequest:ExitPlanMode` hook simplified to instant auto-allow (suppresses native prompt).
- **PORT_FILE heartbeat.** Server touches `/tmp/inkboard.port` every 60 s so `isLikelyAlive()` trust window never expires while server runs. Fixes: sessions > 5 min fell to cold fingerprint path, losing the SIGTERM race.
- **Plan content extraction**: tries `tool_input.plan` from hook stdin first; falls back to mtime-based `.claude/plans/*.md` heuristic.
- **`bridgeHook` now accepts `transformBody` / `transformResponse`** callbacks for protocol translation between hook types.

### 2026-05-18 (v0.2.7)

- **Plan-review hook no longer dies in race with Claude Code's native ExitPlanMode UI.** Removed the 800 ms `/health` fingerprint await from the happy path in `hook-bridge.ts`. New `isLikelyAlive()` check trusts PID + `PORT_FILE` mtime under 5 min; fingerprint only runs on cold path. Stderr "sent to canvas" hint moved before `readStdin()` so it lands even if SIGTERM arrives mid-stdin.

### 2026-05-18 (v0.2.6)

- **Port range moved to 16500–16519** (was 7777–7787, which collided with VS Code Helper / Edge DevTools).
- **IPv4-only bind** (`server.listen(port, "127.0.0.1")`). Previous `::` dual-stack bind let IPv4 squatters intercept the browser's `localhost` lookup.
- **`/health` fingerprint**: includes `app`, `version`, `pid`, `port`. Server self-checks after bind; hook bridge re-checks on cold path.
- **`O_EXCL` lockfile** dedupes concurrent lazy-start spawns.
- **User config moved to `~/.config/inkboard/config.json`** (XDG). `hooks/hooks.json` in the marketplace clone is factory-defaults only.
- **`questionRoutingEnabled` default flipped to `true`**.
- **Connection banner in Home**: live `/health` poll shows port + pid + version.
- **`scripts/uninstall.sh`**: one-shot cleanup of marketplace + cache + installed + `/tmp/inkboard.*`.
- **hook-question timeout** 30 min → 5 min.

### 2026-05-18 (v0.2.5)

- **Plan-review actually reaches the canvas.** Removed the `if (!hasClients()) allow` short-circuit in `hook-plan-review.ts` that fired before `state.addPlanReview()`. Pending is now registered synchronously up-front; broadcast goes out, then we wait up to 20 s for a WS client. Replay-on-reconnect picks up the plan once the browser finishes its handshake. If 20 s elapse with no client, auto-allow + stderr hint pointing at the canvas URL.
- Regression guard test in `state.test.ts`.

### 2026-05-16 (v0.2.0)

- **Question routing toggle**: configurable via `hooks/hooks.json` `settings.questionRoutingEnabled` (default: `false`). When OFF, questions stay in terminal only. When ON, questions route to canvas with a 60-second auto-release timer — if unanswered in canvas within 60s, automatically falls back to terminal.
- **Settings sync**: server reads `hooks/hooks.json` on boot for initial config. Runtime toggle via Home UI broadcasts `settings-sync` to all clients. Toggle state is in-memory (resets on restart to config value).
- **Auto-release**: `question-released` ServerMessage notifies canvas when 60s elapses; canvas clears with toast. Hook returns `{}` → tool executes → terminal picker shows.
- **Hook timeout fix**: Claude Code hook timeout increased from 55s to 120s (must exceed 60s canvas timeout).
- **Install script**: `scripts/install.sh` now auto-generates `.claude/settings.local.json` with correct absolute paths. No manual env vars needed.
- **Removed Diff flow**: dropped `hook-diff.ts`, `diff-parser.ts`, `diff-hook.ts`, `DiffReview.tsx`, related types/store fields, `Edit|Write` hook block, and diff tests.
- **Added Home dashboard** with connection status, pending counts, question routing toggle, active-reviews list, and recent-activity timeline.
- **Session name derivation**: `hook-plan-review.ts` derives `<basename(cwd)> (<sessionId.slice(-4)>)` for plan review tab labels.
