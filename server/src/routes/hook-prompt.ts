import { Router } from "express";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { state } from "../state.js";
import { broadcast, hasClients } from "../ws.js";
import type { HookInput, ServerMessage } from "../types.js";

const router = Router();

router.post("/", async (req, res) => {
  if (!hasClients()) {
    res.json({});
    return;
  }

  const input = req.body as HookInput;
  const projectDir =
    (input.tool_input?.cwd as string) ||
    process.env.INKBOARD_PROJECT_DIR ||
    process.cwd();

  const planDir = join(projectDir, "docs", "plans");
  if (!existsSync(planDir)) {
    res.json({});
    return;
  }

  try {
    const files = readdirSync(planDir).filter((f) => f.endsWith(".md"));

    if (files.length === 0) {
      res.json({});
      return;
    }

    const latestPlan = files.sort().pop()!;
    const planPath = join(planDir, latestPlan);
    const content = readFileSync(planPath, "utf-8");

    state.setPlan(content, planPath);
    const msg: ServerMessage = {
      type: "plan-snapshot",
      content,
      filePath: planPath,
    };
    broadcast(msg);
  } catch (err) {
    console.error("[hook-prompt] plan read failed:", err);
  }

  res.json({});
});

export default router;
