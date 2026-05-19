# Changelog

## 2026-05-20 (v0.2.9 — Multi-session question support)

### New

- **Questions now support multi-session tabs**, mirroring the plan-review pattern. When multiple Claude Code sessions trigger `AskUserQuestion` simultaneously, each gets its own tab in the canvas — no more overwriting.
- Tab bar appears when 2+ questions are pending; badge shows answered count per session.
- Each tab has independent answers, countdown timer, and "Answer in terminal" release.

### Changed

- Store shape: `pendingQuestion: null` → `pendingQuestions: PendingQuestion[]` + `activeQuestionId` + `answersByQuestion` (keyed by question id).
- `setQuestion()` → `upsertQuestion()`, `clearQuestion()` → `clearQuestion(id)`, `setAnswer(text, val)` → `setAnswer(qId, text, val)`.
- `nextActiveAfterRemoval()` generalized from `PendingPlanReview[]` to `ReadonlyArray<{ id: string }>` — reused by both question and plan-review cleanup.
- Layout + Home dashboard badge counts updated.
- **Frontend-only change** — zero server/hook/WS protocol modifications.

## 2026-05-19 (v0.2.8 — PreToolUse plan push + PORT_FILE heartbeat)

### Fixed

- **Plan review now uses `PreToolUse:ExitPlanMode` instead of relying solely on `PermissionRequest`.** The PermissionRequest hook ran concurrently with Claude Code's native ExitPlanMode UI — a race the hook lost whenever sessions exceeded 5 minutes (PORT_FILE mtime expired → cold fingerprint path → SIGTERM). The new architecture:
  - `PreToolUse:ExitPlanMode` (`plan-push-hook.ts`) pushes plan content to the canvas and blocks Claude until the user approves/rejects. Same protocol as AskUserQuestion — no competing native UI, no SIGTERM race.
  - `PermissionRequest:ExitPlanMode` (`plan-review-hook.ts`) simplified to instant auto-allow (10 lines). Exists only to suppress the native plan review prompt.
- **PORT_FILE heartbeat**: server touches `/tmp/inkboard.port` mtime every 60 seconds. The `isLikelyAlive()` trust window (5 min) now never expires while the server is running. Previously, sessions > 5 min always fell to the cold fingerprint path.

### New

- **`plan-push-hook.ts`**: reads plan content from `tool_input.plan` (direct) or falls back to mtime-based `.claude/plans/*.md` scan. Posts to `/hooks/plan-review` route, maps PermissionRequest response format back to PreToolUse format (`{decision: "block", reason}` for deny).
- **`bridgeHook` transform callbacks**: `transformBody` and `transformResponse` options enable protocol translation between hook types without duplicating the port-discovery/lazy-start infrastructure.

### Changed

- `plugin.json`: added `PreToolUse:ExitPlanMode` (timeout 30 min), reduced `PermissionRequest:ExitPlanMode` timeout to 10 s (it's instant now).
- `bundle.mjs`: builds `plan-push-hook.js` alongside existing hooks.
- Version bumped to 0.2.8 across server, web, plugin.json, marketplace.json.

## 2026-05-18 (v0.2.7 — fix plan-review race with native ExitPlanMode UI)

### Fixed

- **Canvas plan-review section stayed empty when the user clicked the native ExitPlanMode permission UI** (P1, UX-blocking). Claude Code displays its native reject/approve prompt *concurrently* with the `PermissionRequest` hook. If the user clicked the native prompt within roughly 100–800 ms of `ExitPlanMode` firing, Claude Code SIGTERM'd our hook child process while it was still awaiting an 800 ms `/health` fingerprint round-trip. Result: `POST /hooks/plan-review` never went out, the server never broadcast, and the canvas Review tab stayed blank. Question hook didn't exhibit this because `AskUserQuestion` has no native reject UI racing with it.
- **Fix**: `hook-bridge.ts` now uses a fast liveness check (`isLikelyAlive`) — PID alive + `PORT_FILE` mtime under 5 minutes — and skips the `/health` round-trip entirely on the happy path. `fingerprintHealthy()` is only called when PID is dead or `PORT_FILE` is missing/stale. Fingerprint abort timeout also reduced from 800 ms to 300 ms for the cold path.
- **Earlier stderr hint**: the `[inkboard] Plan review sent to canvas →` line now writes before `readStdin()` instead of after, so even if Claude Code kills us mid-stdin the user sees where the canvas lives.

### Why the fast path is still safe

- A stale `PORT_FILE` pointing at a recycled port is the only risk we trade off. We mitigate by:
  - PID file must point at an alive process (`kill(0)`), which fails for dead servers.
  - `PORT_FILE` mtime under 5 minutes — anything older drops to the slow path with full fingerprint.
  - Server-side fingerprint after bind (v0.2.6) prevents the wrong port from ever being written to `PORT_FILE` in the first place.

### Out of scope (deferred)

- **Fix 3 — async hook protocol**: would require Claude Code's `PermissionRequest` hook to support an `async: true` ack so the native UI suppresses itself. Not in current protocol; if/when added we can do a one-line follow-up.
- **Fix 2 — streaming POST body**: would parallelise stdin with the HTTP request. Saves at most a few ms; not worth the complexity now.

## 2026-05-18 (v0.2.6 — port collision + stale cache hygiene)

### Fixed (the "canvas opens but review section is empty" bug — round two)

- **Port range moved to 16500–16519** (was 7777–7787). The 777x band was being squatted on macOS by VS Code Helper / Edge DevTools / Code Server, causing `localhost:7778` in the browser to resolve to whichever LISTEN socket the OS picked first — frequently a Code Helper that returned 200 OK but never spoke WebSocket. 16500–16519 is in the IANA unassigned dynamic range with no known squatters.
- **IPv4-only bind** (`server.listen(port, "127.0.0.1")`). Previous behavior dual-stacked on `::`, which could LISTEN successfully on IPv6 even when an IPv4 squatter already held `127.0.0.1:PORT`. Browsers resolve `localhost` IPv4-first by default, so the browser landed on the squatter instead of inkboard.
- **`/health` fingerprint** added: payload now includes `app: "inkboard"`, `version`, `pid`, `port`. Server self-checks fingerprint after bind; hook bridge re-checks before trusting `/tmp/inkboard.port`. Stale port files pointing at recycled ports now belonging to another app are detected and the server is re-spawned.
- **`O_EXCL` lockfile at `/tmp/inkboard-start.lock`** prevents the double-spawn race when two hooks fire concurrently. The first hook spawns; the second polls for readiness.

### Added

- **`questionRoutingEnabled` default flipped to `true`** so a first-time AskUserQuestion lands in the canvas instead of silently no-op'ing in the terminal. Toggle off from the Home dashboard if you prefer terminal pickers.
- **`~/.config/inkboard/config.json` (XDG)** is the new user config location. Bundled `hooks/hooks.json` is now treated as factory defaults only — any plugin update (`git pull` of the marketplace clone) no longer overwrites your toggles.
- **Connection banner in canvas Home**: shows live `inkboard v0.2.6 · pid=N · port=N` from `/health`, plus a red error if the port answered as a non-inkboard process.
- **Structured stderr reasons** when a hook returns `{}`: `routing_disabled` vs `no_canvas_clients` — visible in Claude transcript.
- **`scripts/uninstall.sh`** one-shot cleanup of marketplace + cache + installed + `/tmp/inkboard.*`. Documented in README under "Re-install / upgrade".

### Changed

- `hook-question.ts` default timeout reduced from 30 min to 5 min.
- `hook-bridge.ts` no longer falls back to port 7777 if the port file is missing; it now fails loud with a stderr message pointing at the uninstall script.
- README: new "Re-install / upgrade" section; configuration docs reflect XDG path; environment var table updated to new port range.

### Migration notes

Existing installs: run `bash <(curl -fsSL https://raw.githubusercontent.com/junzhin/inkboard/main/scripts/uninstall.sh)`, then `/plugin marketplace add junzhin/inkboard` + `/plugin install inkboard@inkboard`. The marketplace clone is *not* refreshed by `/plugin marketplace add` alone — only by removing it first.

## 2026-05-18 (v0.2.5 — plan review actually reaches the canvas)

### Fixed

- **Plan review now actually appears in the canvas (the v0.2.4 finish-line bug)**: on a fresh `/plugin install`, triggering ExitPlanMode showed the plan in the terminal and even auto-opened the browser, but the **Review** tab stayed empty. Root cause: `hook-plan-review.ts` short-circuited with `if (!hasClients()) res.json(allow)` *before* registering the pending review. Lazy-start spawns the server and opens the browser in the same instant, so when the hook POSTs `/hooks/plan-review` 50–500 ms later, the WebSocket handshake hasn't finished — `hasClients()` returns `false`, the hook auto-allows, the plan never enters `state.pendingPlanReviews`, and the canvas (once it finally connects) has nothing to replay.
- **Replaced with a grace-period flow**: `addPlanReview` is called synchronously up-front so the pending entry is registered before any wait. Then we wait up to **20 seconds** for a WebSocket client to connect (covers macOS cold-start of Safari/Chrome, ~10–15 s in the worst case). If a client connects, `replayPendingItems()` ships the plan automatically. If 20 seconds elapse with no client, we resolve the pending review as allow (avoiding a 4-day block on a never-opening browser) and write a one-line stderr hint telling the user to open `http://localhost:<port>` manually.
- **Race-condition regression guard**: added a vitest case (`addPlanReview registers pending entry synchronously`) that fails if anyone ever moves the pending-map write inside a `.then()` and silently re-introduces the same bug.

### Removed (dead code / install drift)

- `scripts/postinstall.sh`: never executed by `/plugin install` (Claude Code's plugin loader runs no scripts), and esbuild bundling makes the `npm install` it would have run unnecessary anyway. Removed to stop misleading anyone reading the repo.
- `marketplace.json` `owner.email: ""`: empty string dropped — the field was either lying or harmless, both unnecessary.

### Changed

- `scripts/install.sh` (standalone local-dev installer, **not** plugin install):
  - Fixed README hint inside the script — old text suggested `claude plugin install github:...` which is not a real command. Replaced with the actual `/plugin marketplace add` + `/plugin install` flow.
  - Switched build step from `npx tsc` to `npm run build` (esbuild bundle) so the standalone install produces the same artifacts as the plugin path.
  - Switched `npm install --production` to `npm install` — esbuild is a devDependency required for the build step.

## 2026-05-18 (v0.2.4 — UX: auto-open browser + terminal hint)

### Added

- **Auto-open browser**: server now opens the canvas URL automatically on first start (`open` on macOS, `xdg-open` on Linux, `start` on Windows). No more manual URL-hunting after the first hook fires. Set `INKBOARD_NO_BROWSER=1` to disable (headless / remote use).
- **Terminal hint on hook fire**: every time a hook routes to canvas, `hook-bridge` writes one line to stderr that Claude Code displays in the terminal:
  ```
  [inkboard] Plan review sent to canvas → http://localhost:7777
  ```
  Users now know where to look — and the URL is clickable in modern terminals.

### Changed

- README "How it works" section now includes a "First time you trigger a hook" subsection explaining the auto-open flow, the terminal hint, and the auto-allow-when-no-canvas safety behavior.
- README env table documents `INKBOARD_NO_BROWSER`.

## 2026-05-18 (v0.2.3 — hooks registration fix)

### Fixed

- **Hooks now actually register on plugin install**: `plugin.json` previously had no `hooks` field. Claude Code's plugin loader only registers hooks declared in `plugin.json` — the orphan `hooks/hooks.json` file in the repo was never read. Result: `PreToolUse:AskUserQuestion` and `PermissionRequest:ExitPlanMode` were never wired, hooks scripts never fired, canvas never opened. Detected by Mac install verification — `installed_plugins.json` showed no inkboard hooks registered after `/plugin install`.

### Changed

- Inlined the hook configuration into `plugin.json` under the `hooks` key (Claude Code plugin spec).
- `hooks/hooks.json` now holds only the `settings` block (server-side config, e.g. `questionRoutingEnabled`). Server still reads it on boot.

## 2026-05-18 (v0.2.2 — critical install fix)

### Fixed

- **Plugin install now actually works**: previous releases shipped `server/dist/` (compiled TS) but `server/node_modules/` was excluded by `.gitignore`. Claude Code's `/plugin install` clones the repo without running `npm install`, so the server crashed on every hook trigger with `ERR_MODULE_NOT_FOUND: Cannot find package 'express'`. Hooks then silently fell back via `2>/dev/null || true` and the canvas never opened.

### Changed

- **Build pipeline**: replaced `tsc` direct compilation with `esbuild` bundling. All three entry points (`server/dist/index.js`, `dist/hooks/question-hook.js`, `dist/hooks/plan-review-hook.js`) are now self-contained — express and ws are inlined. Zero runtime npm dependency.
- `npm run build` now runs `node scripts/bundle.mjs` (esbuild). `npm run build:tsc` kept for type-checking.
- Bundled artifact sizes: `index.js` 1.2 MB, hook scripts ~4 KB each. No `node_modules` required for plugin operation.

### Verified

- Removed `server/node_modules/`, ran hook script → server lazy-started in 500ms, `/health` returned 0.2.2, fallback chain not triggered.

## 2026-05-17 (v0.2.1)

### Changed

- **`hook-bridge.ts` lazy start**: rewrote from `execSync("node ... &")` to `child_process.spawn(..., {detached: true, stdio: ["ignore", logFd, logFd]}).unref()`. Cleaner detach, server stdout/stderr captured to `/tmp/inkboard-server.log`, no bash dependency. Polling loop extended to 15s (was 3s) and changed from busy-wait `while (Date.now() < end)` to async `await sleep(250)` to avoid CPU spin during first-time startup port probing.
- **`ws-client.ts` logging**: gated verbose `console.log` / `console.warn` behind `?debug` query string. By default only errors surface to the browser console; pass `http://localhost:7778/?debug` during development to see the connection / message stream.

## 2026-05-17 (v0.2.0 — release)

### Fixed (release blockers)

- **Plugin install path**: `server/dist/` and `web/dist/` are now committed to the repo. `claude /plugin install` clones the repo without running build steps, so shipping pre-built artifacts is required for hooks to resolve `${CLAUDE_PLUGIN_ROOT}/server/dist/hooks/*.js`. Removed `dist/` from `.gitignore`.
- **README install syntax**: replaced incorrect `claude plugin install github:...` CLI form with the actual `/plugin marketplace add` + `/plugin install` flow used inside a Claude Code session.
- **Version drift**: bumped `server/package.json` and `web/package.json` from `0.1.0` → `0.2.0` to match `plugin.json` / `marketplace.json`. Fixed `/health` endpoint hardcoded version. Corrected CLAUDE.md test count (21 → 10, actual vitest run).

### Removed

- Dead dependencies from the dropped Diff flow: `diff`, `@types/diff` (server), `react-diff-viewer-continued` (web). Lockfiles regenerated.

### Added

- `.vscode/`, `_screenshots/`, `portfolio/` to `.gitignore` to keep local dev / screenshot debris out of the public repo.

## 2026-05-16 (v0.2.0)

### Added

- **Question routing toggle**: `hooks/hooks.json` `settings.questionRoutingEnabled` (default: `false`). OFF = questions stay in terminal; ON = questions route to canvas with 60s auto-release fallback.
- **Settings sync over WS**: `settings-sync` ServerMessage sent on connection + on toggle change. `toggle-question-routing` ClientMessage from UI.
- **60s canvas auto-release**: when routing is ON and canvas doesn't answer within 60s, server broadcasts `question-released`, clears canvas, returns `{}` to hook → terminal picker shows.
- **Config loading on boot**: `server/src/index.ts` reads `hooks/hooks.json` settings section at startup to set initial toggle state.
- **Install script auto-configures hooks**: `scripts/install.sh` writes `.claude/settings.local.json` with correct absolute paths. No manual env vars or hook wiring needed.
- **Countdown shows "→ terminal"**: QuestionCanvas countdown now uses `canvasTimeoutMs` (60s) and displays "Xs → terminal" to indicate auto-release destination.

### Fixed

- **Hook timeout**: increased AskUserQuestion Claude Code hook timeout from 55s to 120s (must exceed 60s canvas timeout, otherwise Claude Code kills the process before auto-release fires).
- **stdout buffer flush**: hook-bridge wraps all `process.stdout.write()` in Promise callbacks to ensure buffer flushes before `process.exit(0)`.

### Changed

- `.claude/settings.local.json`: removed stale `Edit|Write` diff-hook matcher; cleaned debug logging from hook commands.

### Removed

- **Diff flow** (`PreToolUse:Edit|Write` per-hunk approval canvas). Deleted:
  - `server/src/routes/hook-diff.ts`
  - `server/src/diff-parser.ts`
  - `server/src/hooks/diff-hook.ts`
  - `web/src/components/DiffReview.tsx`
  - `Hunk`, `Annotation`, `DiffDecision` types
  - `diff` / `diff-decision` / `annotation` WS message variants
  - `pendingDiff`, `hunkDecisions`, `annotations`, `setDiff`, `clearDiff`, `getDiffDecision` store fields
  - `Edit|Write` matcher block in `hooks/hooks.json`
  - Diff lifecycle tests in `server/src/__tests__/state.test.ts`
  - `Diff` entry in Layout nav
- **Rationale**: every Edit/Write blocked Claude for up to 55s waiting for browser approval. Plan Review covers the strategic-review case; per-Edit gating duplicated git diff inspection at higher cost.

### Added

- **Home dashboard** (`web/src/components/Home.tsx`) replaces the empty idle view. Sections:
  - Header: title + connection status badge (Server ready / Disconnected)
  - 3 stat cards: Pending reviews / Pending questions / Port
  - Active plan reviews list with deep-link "Review" buttons per session
  - Recent activity timeline (last 12 events; colored chips per kind)
  - Tips card with kbd shortcuts + debug curl command
- **Activity timeline state** (`store.activity[]`, `pushActivity()`). Entry kinds: `plan-arrived`, `plan-approved`, `plan-denied`, `question-asked`, `question-answered`. Capped at 12 entries. Pushed from:
  - `App.tsx` on WS `plan-review` / `question` messages
  - `PlanAnnotator.tsx` on approve / deny
  - `QuestionCanvas.tsx` on submit
- `formatRelative(ts, now)` helper + 15s `setInterval` re-render keeps "X s/m/h ago" labels fresh.

### Changed

- **Session naming**: `hook-plan-review.ts` `deriveSessionName(input)` now derives a human-readable label from `cwd`:
  - Primary: `<basename(cwd)> (<sessionId.slice(-4)>)` → e.g. `inkboard (a1b2)`
  - Fallback 1: `<basename(transcript_path)>.slice(0,12) + (<short id>)`
  - Fallback 2: `sessionId.slice(0, 8)` (previous behavior)
  - Requires `HookInput` to include `cwd` (Claude Code provides it). Added `cwd?` field to `HookInput` interface.
- **Tab bar** in `PlanAnnotator.tsx` uses the new `sessionName` instead of the old 8-char id slice; tooltip retains full `session_id`.
- **README.md / CLAUDE.md / docs/api.md / docs/architecture.md / docs/hooks-setup.md**: dropped all Diff references; documented session-name derivation and Home dashboard.

### Migration notes

- If you previously wired the `Edit|Write` hook in `~/.claude/settings.json`, remove that block — the hook entrypoint no longer exists. Hooks fail open (auto-pass) if left dangling, so this is non-breaking.
- No data migration required (state is in-memory).

---

## 2026-05-15

### Removed

- **plan-snapshot / MarkdownReview / UserPromptSubmit** read-only plan preview. Replaced by PlanAnnotator (Plan Review), which is a strict superset.

### Added

- **Multi-session plan review**: `planReviews[]` + `activePlanReviewId` + `planAnnotationsByReview` in store. Secondary tab bar in PlanAnnotator switches between concurrent sessions; each carries its own annotation set.
- **Plan rendered as Markdown** via `react-markdown` + `remark-gfm` + `@tailwindcss/typography` (tables, code blocks, lists).
- **Floating toolbar Highlight button** alongside Comment / Delete; empty-comment-as-highlight modal fallback retained.
- **Inline edit + delete** for existing right-rail annotations (`updatePlanAnnotation` store action).
- **Approve (auto-edit)** button alongside plain Approve (hint sent via deny `message` field; downstream tooling honoring is out of scope — see CLAUDE.md "Known limits").
- **Plain Enter submits** comment / Shift+Enter for newline.
- **Toast notifications** (`store.toasts`, `pushToast`) for Approve / Request Changes feedback.
- **Larger comment modal** (`max-w-2xl`, `rows={10}`, `p-6`).

### Fixed

- Floating toolbar flips below selection when `rect.top - 44 < 8`, preventing offscreen clipping for selections near the viewport top.
- Toolbar uses viewport-relative coords (no `scrollY` offset), preventing offscreen toolbar for selections in long-plan lower halves.

### Changed

- Removed timer countdown from Plan Review (4-day effective timeout via hook `timeout` field).
- Removed `InterviewProgress` bar.
- Repo cleanup: dropped `DEVLOG.md`, conversation dumps, snapshot files, `prompt-hook.ts`, dist residues. Added `README.md`, `CLAUDE.md`, `docs/architecture.md`, `docs/hooks-setup.md`, `docs/api.md`.
