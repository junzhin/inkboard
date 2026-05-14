import { Router } from "express";
import { state } from "../state.js";
import { broadcast, hasClients } from "../ws.js";
import type { HookInput, ServerMessage } from "../types.js";

const router = Router();
const TIMEOUT_MS = 54_000;

router.post("/", async (req, res) => {
  const input = req.body as HookInput;

  if (!hasClients()) {
    res.json({});
    return;
  }

  const id = state.nextId();
  const questions = (input.tool_input?.questions as unknown[]) ?? [];

  const msg: ServerMessage = {
    type: "question",
    id,
    questions,
    timeoutMs: TIMEOUT_MS,
  };
  broadcast(msg);

  try {
    const answers = await state.addQuestion(id, questions, TIMEOUT_MS);
    res.json({
      decision: "allow",
      updatedInput: { ...input.tool_input, answers },
    });
  } catch {
    res.json({});
  }
});

export default router;
