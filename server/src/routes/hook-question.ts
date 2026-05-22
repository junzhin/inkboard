import { Router } from "express";
import { state } from "../state.js";
import { broadcast } from "../ws.js";
import type { HookInput, ServerMessage } from "../types.js";

const router = Router();
const TIMEOUT_MS = 5 * 60_000;

router.post("/", async (req, res) => {
  const input = req.body as HookInput;

  if (!state.questionRoutingEnabled) {
    process.stderr.write(
      "[inkboard] question NOT routed: routing disabled (toggle in canvas Home → 'Route questions to canvas').\n"
    );
    res.json({});
    return;
  }

  const id = state.nextId();
  const questions = (input.tool_input?.questions as unknown[]) ?? [];

  const annotations = input.tool_input?.annotations as Record<string, { notes?: string; preview?: string }> | undefined;
  let context = "";
  if (annotations) {
    const notes = Object.values(annotations)
      .map((a) => a.notes)
      .filter(Boolean);
    if (notes.length > 0) context = notes.join("\n");
  }

  // Register pending entry FIRST so a client connecting during the broadcast
  // race picks it up via replayPendingItems() on WS connect. Mirrors v0.2.5
  // plan-review fix. sessionId + context are stored so the replay path can
  // re-emit them (without them, mid-flight reconnecting clients render the
  // question with no session label and no context block — looks like a partial
  // push).
  const answerPromise = state.addQuestion({
    id,
    questions,
    timeoutMs: TIMEOUT_MS,
    sessionId: input.session_id,
    context: context || undefined,
  });

  const msg: ServerMessage = {
    type: "question",
    id,
    questions,
    timeoutMs: TIMEOUT_MS,
    sessionId: input.session_id,
    context: context || undefined,
  };
  broadcast(msg);

  const port = state.boundPort;
  if (port) {
    process.stderr.write(
      `[inkboard] question sent to canvas → http://localhost:${port}\n`
    );
  }

  try {
    const answers = await answerPromise;

    const lines = Object.entries(answers)
      .map(([q, a]) => `- ${q} → ${a}`)
      .join("\n");
    const reason = `User answered via InkBoard canvas. Use these answers directly, do NOT ask again:\n\n${lines}`;

    res.json({
      decision: "block",
      reason,
    });
  } catch {
    res.json({});
  }
});

export default router;
