import { WebSocketServer } from "ws";
import type { Server } from "node:http";
import type { ServerMessage } from "./types.js";
export declare function setupWebSocket(server: Server): WebSocketServer;
export declare function broadcast(msg: ServerMessage): void;
export declare function hasClients(): boolean;
//# sourceMappingURL=ws.d.ts.map