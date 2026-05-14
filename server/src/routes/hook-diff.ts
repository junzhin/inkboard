import { Router } from "express";
import { state } from "../state.js";
import { broadcast, hasClients } from "../ws.js";
import { editToHunks, writeToHunks } from "../diff-parser.js";
import type { HookInput, ServerMessage } from "../types.js";

const router = Router();
const TIMEOUT_MS = 54_000;

router.post("/", async (req, res) => {
  const input = req.body as HookInput;

  if (!hasClients()) {
    res.json({});
    return;
  }

  const toolInput = input.tool_input;
  const filePath = (toolInput.file_path as string) ?? "unknown";
  let hunks;

  if (input.tool_name === "Write") {
    hunks = writeToHunks(filePath, (toolInput.content as string) ?? "");
  } else {
    hunks = editToHunks(
      filePath,
      (toolInput.old_string as string) ?? "",
      (toolInput.new_string as string) ?? ""
    );
  }

  if (hunks.length === 0) {
    res.json({});
    return;
  }

  const id = state.nextId();
  const msg: ServerMessage = {
    type: "diff",
    id,
    filePath,
    hunks,
    timeoutMs: TIMEOUT_MS,
  };
  broadcast(msg);

  try {
    const decision = await state.addDiff(id, filePath, hunks, TIMEOUT_MS);

    if (decision.rejected.length > 0) {
      const annotations = decision.annotations
        .map((a) => `- Line ${a.line}: ${a.text}`)
        .join("\n");

      const reason = [
        `User rejected ${decision.rejected.length} of ${hunks.length} hunks.`,
        annotations ? `\nAnnotations:\n${annotations}` : "",
      ].join("");

      res.json({ decision: "block", reason });
    } else {
      res.json({ decision: "allow" });
    }
  } catch {
    res.json({ decision: "allow" });
  }
});

export default router;
