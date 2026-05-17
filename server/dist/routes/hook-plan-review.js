import { Router } from "express";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { state } from "../state.js";
import { broadcast, hasClients } from "../ws.js";
const router = Router();
// effectively no timeout — match the hook command's `timeout` setting (4 days)
const TIMEOUT_MS = 345_600_000;
function deriveSessionName(input) {
    const sid = input.session_id;
    const shortId = sid ? sid.slice(-4) : undefined;
    const cwd = input.cwd;
    if (cwd) {
        const proj = basename(cwd);
        return shortId ? `${proj} (${shortId})` : proj;
    }
    if (input.transcript_path) {
        const file = basename(input.transcript_path).replace(/\.jsonl$/, "");
        return shortId ? `${file.slice(0, 12)} (${shortId})` : file.slice(0, 12);
    }
    return sid ? sid.slice(0, 8) : undefined;
}
async function extractPlan(input) {
    const ti = input.permission_request?.tool_input ?? input.tool_input ?? {};
    const planInline = ti.plan ?? "";
    const filePath = ti.file_path;
    if (planInline.trim().length > 0)
        return { content: planInline, filePath };
    if (filePath) {
        try {
            const content = await readFile(filePath, "utf-8");
            return { content, filePath };
        }
        catch {
            // fallthrough
        }
    }
    return { content: "(no plan content provided)" };
}
function permissionResponse(behavior, message) {
    return {
        hookSpecificOutput: {
            hookEventName: "PermissionRequest",
            decision: message ? { behavior, message } : { behavior },
        },
    };
}
function formatFeedback(annotations) {
    if (annotations.length === 0) {
        return "User requested changes but provided no annotations.";
    }
    const comments = annotations.filter((a) => a.type === "comment");
    const deletions = annotations.filter((a) => a.type === "deletion");
    const globals = annotations.filter((a) => a.type === "global");
    const out = ["Plan review feedback from InkBoard canvas:", ""];
    if (comments.length > 0) {
        out.push(`## Comments (${comments.length})`);
        for (const a of comments) {
            const snippet = a.selectedText.length > 120 ? a.selectedText.slice(0, 120) + "…" : a.selectedText;
            out.push(`- "${snippet}": ${a.comment ?? "(no comment text)"}`);
        }
        out.push("");
    }
    if (deletions.length > 0) {
        out.push(`## Deletions (${deletions.length})`);
        for (const a of deletions) {
            const snippet = a.selectedText.length > 120 ? a.selectedText.slice(0, 120) + "…" : a.selectedText;
            out.push(`- ~~${snippet}~~ (user marked for removal)`);
        }
        out.push("");
    }
    if (globals.length > 0) {
        out.push(`## Global Notes (${globals.length})`);
        for (const a of globals) {
            out.push(`- ${a.comment ?? a.selectedText}`);
        }
        out.push("");
    }
    out.push("Please incorporate these changes and re-present the plan.");
    return out.join("\n");
}
router.post("/", async (req, res) => {
    const input = req.body;
    if (!hasClients()) {
        res.json(permissionResponse("allow"));
        return;
    }
    const id = state.nextId();
    const { content, filePath } = await extractPlan(input);
    const sessionId = input.session_id ?? undefined;
    const sessionName = deriveSessionName(input);
    const msg = {
        type: "plan-review",
        id,
        content,
        filePath,
        timeoutMs: TIMEOUT_MS,
        sessionId,
        sessionName,
    };
    broadcast(msg);
    try {
        const decision = await state.addPlanReview({
            id,
            content,
            filePath,
            timeoutMs: TIMEOUT_MS,
            sessionId,
            sessionName,
        });
        if (decision.approved) {
            const message = decision.autoEdit
                ? "User approved plan AND requested auto-edit mode: proceed without prompting for individual file edit confirmations."
                : undefined;
            res.json(permissionResponse("allow", message));
            return;
        }
        res.json(permissionResponse("deny", formatFeedback(decision.annotations)));
    }
    catch {
        // timeout: auto-approve to avoid blocking Claude indefinitely
        res.json(permissionResponse("allow"));
    }
});
export default router;
//# sourceMappingURL=hook-plan-review.js.map