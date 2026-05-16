# Architecture

## Components

```
┌────────────────────┐                          ┌──────────────────────┐
│  Claude Code CLI   │                          │  Browser canvas       │
│                    │                          │  (web/dist, React)    │
│  hook entrypoint ──┼──── stdin: HookInput     │                       │
│  (server/dist/      │                          │   ┌────────────┐     │
│   hooks/*.js)       │                          │   │Home          │   │
└─────────┬──────────┘                          │   │QuestionCanvas│   │
          │ HTTP POST /hooks/<flow>             │   │PlanAnnotator │   │
          ▼                                      │   └────────────┘     │
┌────────────────────────────────────────────────┴───────────────────────┐
│                         InkBoard server (:7777-:7787)                   │
│                                                                          │
│  Express  ─ /hooks/question      ─┐                                     │
│           ─ /hooks/plan-review    ├─►  state (in-memory Map of pending) │
│                                                                          │
│  WebSocket ──── broadcast ServerMessage to all clients                  │
│            ◄─── handle ClientMessage (answer / decision)                │
└──────────────────────────────────────────────────────────────────────────┘
```

## Data flow

### Outbound (Claude → browser)

1. Claude triggers a hook (e.g. `ExitPlanMode` permission request).
2. Hook entrypoint reads `HookInput` JSON on stdin, POSTs to the matching `/hooks/<flow>` endpoint.
3. Route handler:
   - Generates an id via `state.nextId()`.
   - Stores a Promise via `state.add<Flow>(id, ..., timeoutMs)`.
   - Broadcasts a `ServerMessage` to all WebSocket clients.
   - Awaits the Promise (resolved by inbound message or timeout).
4. Route returns the hook's stdout payload, hook entrypoint forwards it back to Claude.

### Inbound (browser → Claude)

1. User clicks Approve / Reject / Submit on a canvas.
2. Component sends a `ClientMessage` via `wsClient.send()`.
3. WebSocket server dispatches via `handleClientMessage()` → `state.resolve<Flow>(id, decision)`.
4. The Promise from step 3 above resolves; route handler builds the hook response payload.

### Replay on reconnect

When a client (re)connects, `replayPendingItems()` walks the three pending Maps and re-broadcasts each entry to that single client. This makes browser refresh safe and supports "open the canvas after the hook fired" workflows.

## State lifecycle

| State                           | Created                                | Destroyed                                          |
| ------------------------------- | -------------------------------------- | -------------------------------------------------- |
| `state.pendingQuestions[id]`    | `state.addQuestion()`                  | `state.resolveQuestion()` or timeout               |
| `state.pendingPlanReviews[id]`  | `state.addPlanReview()`                | `state.resolvePlanReview()` or timeout             |

`state.reset()` clears everything (used in tests; not exposed at runtime).

## Multi-session

Plan review supports multiple concurrent sessions. Each Claude Code window that fires `ExitPlanMode` produces a separate entry in `pendingPlanReviews`, keyed by hook-generated id and tagged with the original `session_id`. The hook route derives a human-readable `sessionName` from `cwd` basename + last 4 chars of `session_id` (e.g. `inkboard (a1b2)`). The browser canvas displays a secondary tab bar listing all pending reviews; switching tabs swaps the active review and its annotation set (`planAnnotationsByReview[reviewId]`).

## Question routing

Questions use a configurable routing toggle (`state.questionRoutingEnabled`):

- **OFF (default)**: `/hooks/question` route returns `{}` immediately → hook passes through → Claude Code executes `AskUserQuestion` tool → terminal picker shows.
- **ON**: route broadcasts to canvas, waits up to 60s for a web answer. If answered → returns `{decision: "block", reason: <answers>}` → tool blocked → terminal never shows. If 60s elapses → auto-releases → broadcasts `question-released` → canvas clears → route returns `{}` → terminal shows.

Config source: `hooks/hooks.json` `settings.questionRoutingEnabled` (read on boot). Runtime override: toggle switch on Home dashboard sends `toggle-question-routing` ClientMessage → server updates state + broadcasts `settings-sync` to all clients.

## Home dashboard

The idle (no-pending) view renders `Home`, which shows: connection status, port, pending review count, pending question count, question routing toggle, an active-reviews list with deep links to the Review surface, and a recent-activity timeline (`store.activity[]`, capped at 12 entries). Activity entries are pushed on `plan-arrived`, `plan-approved`, `plan-denied`, `question-asked`, `question-answered`.

## Files of interest

| File                                              | Role                                      |
| ------------------------------------------------- | ----------------------------------------- |
| `server/src/index.ts`                             | Express bootstrap, port probing, mounts   |
| `server/src/state.ts`                             | In-memory Promise registry                |
| `server/src/ws.ts`                                | WebSocket setup, replay, dispatch         |
| `server/src/routes/hook-*.ts`                     | One route per flow                        |
| `server/src/hooks/*-hook.ts`                      | CLI entrypoints invoked by Claude Code    |
| `web/src/store.ts`                                | Zustand store + activity timeline         |
| `web/src/ws-client.ts`                            | WebSocket client + auto-reconnect         |
| `web/src/components/Home.tsx`                     | Idle dashboard (status, pending, activity)|
| `web/src/components/PlanAnnotator.tsx`            | Plan review canvas (multi-session, tabs)  |
| `web/src/components/QuestionCanvas.tsx`           | AskUserQuestion form                      |
