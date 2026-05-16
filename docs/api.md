# API reference

## HTTP

### `GET /health`
Returns `{ status: "ok", version: "0.1.0" }`.

### `POST /hooks/question`
Body: Claude Code `HookInput` for `AskUserQuestion`.
Behavior:
- If `state.questionRoutingEnabled` is `false` OR no WebSocket clients → returns `{}` immediately (pass-through to terminal).
- Otherwise: extracts `tool_input.questions`, broadcasts `{type: "question", id, questions, timeoutMs, canvasTimeoutMs: 60000}`, starts a 60s auto-release timer, waits for the matching `answer` ClientMessage.
- If answered within 60s → returns `{decision: "block", reason: <formatted answers>}`.
- If 60s elapses → auto-releases (broadcasts `question-released`) → returns `{}` (falls back to terminal).

### `POST /hooks/plan-review`
Body: Claude Code `HookInput` for `PermissionRequest:ExitPlanMode`.
Behavior:
- Extracts plan content from `tool_input.plan` (inline) or `tool_input.file_path` (read from disk).
- Pulls `session_id` and `cwd` from the input; derives `sessionName` as `<basename(cwd)> (<sessionId.slice(-4)>)`. Falls back to transcript filename, then to `sessionId.slice(0,8)`.
- Broadcasts `{type: "plan-review", id, content, filePath, timeoutMs, sessionId, sessionName}`.
- Awaits `plan-review-decision`. Returns:
  - approved → `{hookSpecificOutput: {decision: {behavior: "allow", message?: <auto-edit hint>}}}`
  - denied → `{hookSpecificOutput: {decision: {behavior: "deny", message: <formatted feedback>}}}`
  - timeout → auto-allow

### Debug

`GET /debug/push-question` — broadcasts a synthetic question.
`GET /debug/push-plan-review?session=<id>&name=<label>` — pushes a plan review to all clients AND registers in state for replay.

## WebSocket

Connect to `ws://localhost:<port>/`.

### Server → Client (`ServerMessage`)

```ts
| { type: "server-status";    status: "ready" | "waiting" }
| { type: "settings-sync";    questionRoutingEnabled: boolean }
| { type: "question";         id: string; questions: Question[]; timeoutMs: number;
                              canvasTimeoutMs?: number; sessionId?: string; context?: string }
| { type: "question-released"; id: string }
| { type: "plan-review";      id: string; content: string; filePath?: string; timeoutMs: number;
                              sessionId?: string; sessionName?: string }
```

### Client → Server (`ClientMessage`)

```ts
| { type: "answer";                  id: string; answers: Record<string, string> }
| { type: "question-release";        id: string }
| { type: "plan-review-decision";    id: string; decision: PlanReviewDecision }
| { type: "toggle-question-routing"; enabled: boolean }
```

### `PlanReviewDecision`

```ts
{
  approved: boolean;
  annotations: PlanAnnotation[];
  autoEdit?: boolean;       // true when "Approve (auto edit)" was clicked
}
```

### `PlanAnnotation`

```ts
{
  id: string;
  type: "comment" | "deletion" | "global";
  selectedText: string;
  comment?: string;
  createdAt: number;
}
```
