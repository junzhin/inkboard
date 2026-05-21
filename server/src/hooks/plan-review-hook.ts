#!/usr/bin/env node
// PermissionRequest:ExitPlanMode — auto-allow ONLY when PreToolUse plan-push-hook
// has written a fresh approval marker for this session. Otherwise return empty
// `{}` (no opinion) so Claude Code's native plan review UI handles the request.
//
// Why: without this gate, when the server is unreachable PreToolUse falls back
// to "{}" (allow) and PermissionRequest still auto-allows, silently bypassing
// both the canvas AND the native UI. User sees plan jump straight to execution
// with no chance to review.
import { appendFileSync, existsSync, statSync, unlinkSync } from "node:fs";

const LOG_FILE = "/tmp/inkboard-plan-review.log";
const APPROVED_MARKER_PREFIX = "/tmp/inkboard-plan-approved-";
const MARKER_MAX_AGE_MS = 60_000;

function debug(msg: string): void {
  try {
    appendFileSync(LOG_FILE, `${new Date().toISOString()} ${msg}\n`);
  } catch { /* ignore */ }
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.resume();
  });
}

async function main(): Promise<void> {
  const stdin = await readStdin();
  let sessionId = "";
  try {
    const input = JSON.parse(stdin) as { session_id?: string };
    sessionId = input.session_id ?? "";
  } catch {
    debug("stdin parse failed");
  }

  if (!sessionId) {
    debug("no session_id — returning empty (let native UI handle)");
    process.stdout.write("{}", () => process.exit(0));
    return;
  }

  const markerPath = `${APPROVED_MARKER_PREFIX}${sessionId}`;
  if (existsSync(markerPath)) {
    try {
      const age = Date.now() - statSync(markerPath).mtimeMs;
      if (age < MARKER_MAX_AGE_MS) {
        try { unlinkSync(markerPath); } catch { /* ignore */ }
        debug(`AUTO_ALLOW session=${sessionId} marker_age_ms=${age}`);
        const response = JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "PermissionRequest",
            decision: { behavior: "allow" },
          },
        });
        process.stdout.write(response, () => process.exit(0));
        return;
      }
      debug(`marker stale session=${sessionId} age_ms=${age} — letting native UI handle`);
      try { unlinkSync(markerPath); } catch { /* ignore */ }
    } catch (err) {
      debug(`marker stat failed: ${err}`);
    }
  } else {
    debug(`no marker for session=${sessionId} — letting native UI handle (canvas push likely failed)`);
  }

  // Empty `{}` = no hook decision; Claude Code's native plan review UI runs.
  process.stdout.write("{}", () => process.exit(0));
}

main().catch((err) => {
  debug(`fatal: ${err}`);
  process.stdout.write("{}", () => process.exit(0));
});
