#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { bridgeHook } from "./hook-bridge.js";

function findLatestPlanFile(cwd: string): { content: string; path: string; mtime: number } | null {
  const plansDir = join(cwd, ".claude", "plans");
  if (!existsSync(plansDir)) return null;
  const files = readdirSync(plansDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const p = join(plansDir, f);
      return { path: p, mtime: statSync(p).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  if (files.length === 0) return null;
  const best = files[0];
  return { content: readFileSync(best.path, "utf-8"), path: best.path, mtime: best.mtime };
}

const PLAN_RECENCY_MS = 10 * 60_000;

function transformBody(stdin: string): string {
  let input: {
    session_id?: string;
    cwd?: string;
    transcript_path?: string;
    tool_name?: string;
    tool_input?: Record<string, unknown>;
  };
  try {
    input = JSON.parse(stdin);
  } catch {
    return stdin;
  }
  const toolInput = input.tool_input ?? {};
  let plan = (toolInput.plan as string | undefined) ?? "";
  let filePath = toolInput.file_path as string | undefined;

  if (!plan.trim() && input.cwd) {
    const found = findLatestPlanFile(input.cwd);
    if (found && Date.now() - found.mtime < PLAN_RECENCY_MS) {
      plan = found.content;
      filePath = found.path;
    }
  }

  if (!plan.trim()) return stdin;

  return JSON.stringify({
    ...input,
    tool_input: { ...toolInput, plan, file_path: filePath },
    permission_request: { tool_input: { plan, file_path: filePath } },
  });
}

function transformResponse(body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      hookSpecificOutput?: {
        decision?: { behavior?: string; message?: string };
      };
    };
    const behavior = parsed?.hookSpecificOutput?.decision?.behavior;
    const message = parsed?.hookSpecificOutput?.decision?.message;
    if (behavior === "deny") {
      return JSON.stringify({
        decision: "block",
        reason: message ?? "Changes requested in InkBoard canvas",
      });
    }
    return "{}";
  } catch {
    return "{}";
  }
}

bridgeHook("/hooks/plan-review", {
  fallback: "{}",
  timeoutMs: 1_800_000,
  logFile: "/tmp/inkboard-plan-push.log",
  transformBody,
  transformResponse,
});
