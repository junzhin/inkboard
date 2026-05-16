import { Router } from "express";
import { state } from "../state.js";
import { broadcast, hasClients } from "../ws.js";
import type { HookInput, ServerMessage } from "../types.js";

const router = Router();
const TIMEOUT_MS = 1_800_000;
const CANVAS_TIMEOUT_MS = 60_000;

router.post("/", async (req, res) => {
  const input = req.body as HookInput;

  if (!state.questionRoutingEnabled || !hasClients()) {
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

  const msg: ServerMessage = {
    type: "question",
    id,
    questions,
    timeoutMs: TIMEOUT_MS,
    canvasTimeoutMs: CANVAS_TIMEOUT_MS,
    sessionId: input.session_id,
    context: context || undefined,
  };
  broadcast(msg);

  const releaseTimer = setTimeout(() => {
    if (state.releaseQuestion(id)) {
      broadcast({ type: "question-released", id });
    }
  }, CANVAS_TIMEOUT_MS);

  try {
    const answers = await state.addQuestion(id, questions, TIMEOUT_MS);
    clearTimeout(releaseTimer);

    const lines = Object.entries(answers)
      .map(([q, a]) => `- ${q} → ${a}`)
      .join("\n");
    const reason = `User answered via InkBoard canvas. Use these answers directly, do NOT ask again:\n\n${lines}`;

    res.json({
      decision: "block",
      reason,
    });
  } catch {
    clearTimeout(releaseTimer);
    res.json({});
  }
});

export default router;
