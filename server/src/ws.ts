import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import type { ClientMessage, ServerMessage } from "./types.js";
import { state } from "./state.js";

const clients = new Set<WebSocket>();

export function setupWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    clients.add(ws);

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as ClientMessage;
        handleClientMessage(msg);
      } catch {
        // invalid message, ignore
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
    });

    const status: ServerMessage = { type: "server-status", status: "ready" };
    ws.send(JSON.stringify(status));

    replayPendingItems(ws);
  });

  return wss;
}

function replayPendingItems(ws: WebSocket): void {
  for (const [id, pending] of state.pendingQuestions) {
    const elapsed = Date.now() - (pending as { createdAt?: number }).createdAt!;
    const remainingMs = Math.max(0, 54_000 - elapsed);
    if (remainingMs <= 0) continue;

    const msg: ServerMessage = {
      type: "question",
      id,
      questions: pending.questions,
      timeoutMs: remainingMs,
    };
    ws.send(JSON.stringify(msg));
  }

  for (const [id, pending] of state.pendingDiffs) {
    const elapsed = Date.now() - (pending as { createdAt?: number }).createdAt!;
    const remainingMs = Math.max(0, 54_000 - elapsed);
    if (remainingMs <= 0) continue;

    const msg: ServerMessage = {
      type: "diff",
      id,
      filePath: pending.filePath,
      hunks: pending.hunks,
      timeoutMs: remainingMs,
    };
    ws.send(JSON.stringify(msg));
  }

  if (state.currentPlan) {
    const msg: ServerMessage = {
      type: "plan-snapshot",
      content: state.currentPlan.content,
      filePath: state.currentPlan.filePath,
    };
    ws.send(JSON.stringify(msg));
  }
}

function handleClientMessage(msg: ClientMessage): void {
  switch (msg.type) {
    case "answer":
      state.resolveQuestion(msg.id, msg.answers);
      break;
    case "diff-decision":
      state.resolveDiff(msg.id, msg.decision);
      break;
    case "annotation":
      break;
  }
}

export function broadcast(msg: ServerMessage): void {
  const data = JSON.stringify(msg);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

export function hasClients(): boolean {
  return clients.size > 0;
}
