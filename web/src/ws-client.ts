import type { ClientMessage, ServerMessage } from "./types";

type MessageHandler = (msg: ServerMessage) => void;

const DEBUG =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("debug");

function logDebug(...args: unknown[]): void {
  if (DEBUG) console.log("[inkboard]", ...args);
}

function logWarn(...args: unknown[]): void {
  if (DEBUG) console.warn("[inkboard]", ...args);
}

function logError(...args: unknown[]): void {
  console.error("[inkboard]", ...args);
}

class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers = new Set<MessageHandler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    )
      return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      logDebug("connected to server");
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        logDebug("recv:", msg.type, msg);
        for (const handler of this.handlers) {
          handler(msg);
        }
      } catch (err) {
        logError("invalid message:", err, event.data);
      }
    };

    this.ws.onclose = (ev) => {
      logWarn("disconnected", ev.code, ev.reason, "reconnecting in 2s...");
      this.reconnectTimer = setTimeout(() => this.connect(), 2000);
    };

    this.ws.onerror = (ev) => {
      logError("ws error", ev);
      this.ws?.close();
    };
  }

  send(msg: ClientMessage): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close();
  }
}

const wsUrl = `ws://${window.location.host}`;
logDebug("WS URL:", wsUrl);
export const wsClient = new WebSocketClient(wsUrl);
