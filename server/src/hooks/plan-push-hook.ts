#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { bridgeHook } from "./hook-bridge.js";

const LOG_FILE = "/tmp/inkboard-plan-push.log";

function debug(msg: string): void {
  try {
    appendFileSync(LOG_FILE, `${new Date().toISOString()} [plan-push] ${msg}\n`);
  } catch { /* ignore */ }
}

function findLatestPlanFile(cwd: string): { content: string; path: string; mtime: number } | null {
  const plansDir = join(cwd, ".claude", "plans");
  if (!existsSync(plansDir)) {
    debug(`plans dir not found: ${plansDir}`);
    return null;
  }
  const files = readdirSync(plansDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const p = join(plansDir, f);
      return { path: p, mtime: statSync(p).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  if (files.length === 0) {
    debug("plans dir exists but no .md files");
    return null;
  }
  const best = files[0];
  const ageMs = Date.now() - best.mtime;
  debug(`best plan: ${best.path} age=${Math.round(ageMs / 1000)}s`);
  return { content: readFileSync(best.path, "utf-8"), path: best.path, mtime: best.mtime };
}

const PLAN_RECENCY_MS = 30 * 60_000;

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
    debug("JSON parse failed on stdin");
    return stdin;
  }

  debug(`tool_name=${input.tool_name ?? "?"} cwd=${input.cwd ?? "?"} session=${input.session_id ?? "?"}`);

  const toolInput = input.tool_input ?? {};
  let plan = (toolInput.plan as string | undefined) ?? "";
  let filePath = toolInput.file_path as string | undefined;

  debug(`tool_input.plan length=${plan.length} file_path=${filePath ?? "none"}`);

  if (!plan.trim() && input.cwd) {
    const found = findLatestPlanFile(input.cwd);
    if (found && Date.now() - found.mtime < PLAN_RECENCY_MS) {
      plan = found.content;
      filePath = found.path;
      debug(`using plan file: ${filePath} (${plan.length} chars)`);
    } else if (found) {
      debug(`plan file too old: age=${Math.round((Date.now() - found.mtime) / 1000)}s > ${PLAN_RECENCY_MS / 1000}s`);
    }
  }

  if (!plan.trim()) {
    debug("no plan content found — passing stdin through unchanged");
    return stdin;
  }

  debug(`plan found (${plan.length} chars), enriching body for server`);

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
      debug(`decision=deny message=${message?.slice(0, 80) ?? "none"}`);
      return JSON.stringify({
        decision: "block",
        reason: message ?? "Changes requested in InkBoard canvas",
      });
    }
    debug(`decision=allow`);
    return "{}";
  } catch {
    debug("transformResponse parse error — allowing");
    return "{}";
  }
}

bridgeHook("/hooks/plan-review", {
  fallback: "{}",
  timeoutMs: 1_800_000,
  logFile: LOG_FILE,
  transformBody,
  transformResponse,
});
