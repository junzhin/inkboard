import express from "express";
import { createServer } from "node:http";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, existsSync } from "node:fs";
import { setupWebSocket } from "./ws.js";
import questionRouter from "./routes/hook-question.js";
import diffRouter from "./routes/hook-diff.js";
import promptRouter from "./routes/hook-prompt.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT_START = 7777;
const PORT_END = 7787;
const PID_FILE = "/tmp/inkboard.pid";
const PORT_FILE = "/tmp/inkboard.port";

const app = express();
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", version: "0.1.0" });
});

app.use("/hooks/question", questionRouter);
app.use("/hooks/diff", diffRouter);
app.use("/hooks/prompt", promptRouter);

const webDist = join(__dirname, "..", "..", "web", "dist");
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get("*", (_req, res) => {
    res.sendFile(join(webDist, "index.html"));
  });
}

const server = createServer(app);
setupWebSocket(server);

async function findPort(): Promise<number> {
  for (let port = PORT_START; port <= PORT_END; port++) {
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, () => {
          server.removeListener("error", reject);
          resolve();
        });
      });
      return port;
    } catch {
      continue;
    }
  }
  throw new Error(`No available port in ${PORT_START}-${PORT_END}`);
}

findPort().then((port) => {
  writeFileSync(PID_FILE, String(process.pid));
  writeFileSync(PORT_FILE, String(port));
  console.log(`[inkboard] server running on http://localhost:${port}`);
  console.log(`[inkboard] PID ${process.pid} written to ${PID_FILE}`);
});

process.on("SIGINT", () => {
  console.log("\n[inkboard] shutting down...");
  server.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  server.close();
  process.exit(0);
});
