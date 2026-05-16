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

Tests: `cd server && npm test` (vitest, 21 tests).

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

## Known limits

- **Approve (auto-edit)** sends a hint via the deny `message` field, but Claude Code's `PermissionRequest` decision schema does not actually toggle auto-edit mode for subsequent file edits. The button is honest about its intent; whether downstream tooling honors it is out of scope.
- **No persistence**: pending reviews lost on server restart.
- **Single-user, single-machine**: no auth, binds to localhost only.

## What NOT to do

- Don't reintroduce `plan-snapshot` / `MarkdownReview` / `UserPromptSubmit` plumbing — removed because Plan Review supersedes it.
- Don't reintroduce per-Edit/Write diff gating (`hook-diff` / `DiffReview`) — removed because per-hunk approval added high friction without strategic value; Plan Review covers the strategic case.
- Don't bypass `state.add*` and broadcast directly; replay-on-reconnect won't work.
- Don't add state mutations or Promise wrappers for things that should be transient UI state.

## Changelog

### 2026-05-16 (v0.2.0)

- **Question routing toggle**: configurable via `hooks/hooks.json` `settings.questionRoutingEnabled` (default: `false`). When OFF, questions stay in terminal only. When ON, questions route to canvas with a 60-second auto-release timer — if unanswered in canvas within 60s, automatically falls back to terminal.
- **Settings sync**: server reads `hooks/hooks.json` on boot for initial config. Runtime toggle via Home UI broadcasts `settings-sync` to all clients. Toggle state is in-memory (resets on restart to config value).
- **Auto-release**: `question-released` ServerMessage notifies canvas when 60s elapses; canvas clears with toast. Hook returns `{}` → tool executes → terminal picker shows.
- **Hook timeout fix**: Claude Code hook timeout increased from 55s to 120s (must exceed 60s canvas timeout).
- **Install script**: `scripts/install.sh` now auto-generates `.claude/settings.local.json` with correct absolute paths. No manual env vars needed.
- **Removed Diff flow**: dropped `hook-diff.ts`, `diff-parser.ts`, `diff-hook.ts`, `DiffReview.tsx`, related types/store fields, `Edit|Write` hook block, and diff tests.
- **Added Home dashboard** with connection status, pending counts, question routing toggle, active-reviews list, and recent-activity timeline.
- **Session name derivation**: `hook-plan-review.ts` derives `<basename(cwd)> (<sessionId.slice(-4)>)` for plan review tab labels.
