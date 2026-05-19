#!/usr/bin/env node
import { createRequire } from 'module'; const require = createRequire(import.meta.url);

// src/hooks/plan-review-hook.ts
import { appendFileSync } from "node:fs";
try {
  appendFileSync(
    "/tmp/inkboard-plan-review.log",
    `${(/* @__PURE__ */ new Date()).toISOString()} AUTO_ALLOW (push handled by PreToolUse)
`
  );
} catch {
}
var response = JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PermissionRequest",
    decision: { behavior: "allow" }
  }
});
process.stdout.write(response, () => process.exit(0));
