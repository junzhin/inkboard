#!/usr/bin/env node
import { bridgeHook } from "./hook-bridge.js";
const AUTO_ALLOW = JSON.stringify({
    hookSpecificOutput: {
        hookEventName: "PermissionRequest",
        decision: { behavior: "allow" },
    },
});
bridgeHook("/hooks/plan-review", {
    fallback: AUTO_ALLOW,
    // 4 days, matches TIMEOUT_MS in hook-plan-review.ts route
    timeoutMs: 345_600_000,
    logFile: "/tmp/inkboard-plan-review.log",
});
//# sourceMappingURL=plan-review-hook.js.map