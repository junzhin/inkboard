import { WebSocketServer, WebSocket } from "ws";
import { state } from "./state.js";
const clients = new Set();
export function setupWebSocket(server) {
    const wss = new WebSocketServer({ server });
    wss.on("connection", (ws) => {
        clients.add(ws);
        ws.on("message", (data) => {
            try {
                const msg = JSON.parse(data.toString());
                handleClientMessage(msg);
            }
            catch {
                // invalid message, ignore
            }
        });
        ws.on("close", () => {
            clients.delete(ws);
        });
        ws.on("error", () => {
            clients.delete(ws);
        });
        const status = { type: "server-status", status: "ready" };
        ws.send(JSON.stringify(status));
        const settings = { type: "settings-sync", questionRoutingEnabled: state.questionRoutingEnabled };
        ws.send(JSON.stringify(settings));
        replayPendingItems(ws);
    });
    return wss;
}
function replayPendingItems(ws) {
    const now = Date.now();
    for (const [id, pending] of state.pendingQuestions) {
        const remainingMs = pending.deadline - now;
        if (remainingMs <= 0)
            continue;
        const msg = {
            type: "question",
            id,
            questions: pending.questions,
            timeoutMs: remainingMs,
        };
        ws.send(JSON.stringify(msg));
    }
    for (const [id, pending] of state.pendingPlanReviews) {
        const remainingMs = pending.deadline - now;
        if (remainingMs <= 0)
            continue;
        const msg = {
            type: "plan-review",
            id,
            content: pending.content,
            filePath: pending.filePath,
            timeoutMs: remainingMs,
            sessionId: pending.sessionId,
            sessionName: pending.sessionName,
        };
        ws.send(JSON.stringify(msg));
    }
}
function handleClientMessage(msg) {
    switch (msg.type) {
        case "answer":
            state.resolveQuestion(msg.id, msg.answers);
            break;
        case "question-release":
            state.releaseQuestion(msg.id);
            break;
        case "plan-review-decision":
            state.resolvePlanReview(msg.id, msg.decision);
            break;
        case "toggle-question-routing":
            state.questionRoutingEnabled = msg.enabled;
            broadcast({ type: "settings-sync", questionRoutingEnabled: msg.enabled });
            break;
    }
}
export function broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    }
}
export function hasClients() {
    for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN)
            return true;
    }
    return false;
}
//# sourceMappingURL=ws.js.map