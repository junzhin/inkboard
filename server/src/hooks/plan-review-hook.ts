#!/usr/bin/env node
// PermissionRequest:ExitPlanMode — auto-allow immediately.
// Plan push + canvas decision is handled by PreToolUse:ExitPlanMode (plan-push-hook).
// This hook exists only to suppress Claude Code's native plan review UI.
import { appendFileSync } from "node:fs";

try {
  appendFileSync(
    "/tmp/inkboard-plan-review.log",
    `${new Date().toISOString()} AUTO_ALLOW (push handled by PreToolUse)\n`
  );
} catch {}

const response = JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PermissionRequest",
    decision: { behavior: "allow" },
  },
});

process.stdout.write(response, () => process.exit(0));
