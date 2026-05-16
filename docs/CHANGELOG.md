# Changelog

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
