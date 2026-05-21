#!/usr/bin/env node
import { createRequire } from 'module'; const require = createRequire(import.meta.url);

// src/hooks/plan-review-hook.ts
import { appendFileSync, existsSync, statSync, unlinkSync } from "node:fs";
var LOG_FILE = "/tmp/inkboard-plan-review.log";
var APPROVED_MARKER_PREFIX = "/tmp/inkboard-plan-approved-";
var MARKER_MAX_AGE_MS = 6e4;
function debug(msg) {
  try {
    appendFileSync(LOG_FILE, `${(/* @__PURE__ */ new Date()).toISOString()} ${msg}
`);
  } catch {
  }
}
function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => data += chunk);
    process.stdin.on("end", () => resolve(data));
    process.stdin.resume();
  });
}
async function main() {
  const stdin = await readStdin();
  let sessionId = "";
  try {
    const input = JSON.parse(stdin);
    sessionId = input.session_id ?? "";
  } catch {
    debug("stdin parse failed");
  }
  if (!sessionId) {
    debug("no session_id \u2014 returning empty (let native UI handle)");
    process.stdout.write("{}", () => process.exit(0));
    return;
  }
  const markerPath = `${APPROVED_MARKER_PREFIX}${sessionId}`;
  if (existsSync(markerPath)) {
    try {
      const age = Date.now() - statSync(markerPath).mtimeMs;
      if (age < MARKER_MAX_AGE_MS) {
        try {
          unlinkSync(markerPath);
        } catch {
        }
        debug(`AUTO_ALLOW session=${sessionId} marker_age_ms=${age}`);
        const response = JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "PermissionRequest",
            decision: { behavior: "allow" }
          }
        });
        process.stdout.write(response, () => process.exit(0));
        return;
      }
      debug(`marker stale session=${sessionId} age_ms=${age} \u2014 letting native UI handle`);
      try {
        unlinkSync(markerPath);
      } catch {
      }
    } catch (err) {
      debug(`marker stat failed: ${err}`);
    }
  } else {
    debug(`no marker for session=${sessionId} \u2014 letting native UI handle (canvas push likely failed)`);
  }
  process.stdout.write("{}", () => process.exit(0));
}
main().catch((err) => {
  debug(`fatal: ${err}`);
  process.stdout.write("{}", () => process.exit(0));
});
