import type { ClientMessage, ServerMessage } from "./types";

type MessageHandler = (msg: ServerMessage) => void;

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
      console.log("[inkboard] connected to server");
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        for (const handler of this.handlers) {
          handler(msg);
        }
      } catch (err) {
        console.error("[inkboard] invalid message:", err);
      }
    };

    this.ws.onclose = () => {
      console.log("[inkboard] disconnected, reconnecting in 2s...");
      this.reconnectTimer = setTimeout(() => this.connect(), 2000);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
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
export const wsClient = new WebSocketClient(wsUrl);
