import express from "express";
import { createServer } from "node:http";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { setupWebSocket, broadcast, hasClients } from "./ws.js";
import { state } from "./state.js";
import questionRouter from "./routes/hook-question.js";
import planReviewRouter from "./routes/hook-plan-review.js";

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
app.use("/hooks/plan-review", planReviewRouter);

// Debug endpoints — disabled when NODE_ENV=production to keep state-mutating GETs out of prod.
if (process.env.NODE_ENV !== "production") {
  let debugReviewCounter = 0;
  app.get("/debug/push-plan-review", (req, res) => {
    const id = state.nextId();
    const seq = ++debugReviewCounter;
    const sessionId = (req.query.session as string) ?? `dbg_session_${seq.toString().padStart(4, "0")}`;
    const sessionName = (req.query.name as string) ?? `Demo ${seq}`;
    const content = `# Sample Plan ${seq}\n\n## Goal\nBuild feature X for session ${sessionName}.\n\n## Steps\n1. Refactor module A\n2. Add Redis cache layer\n3. Deploy to production\n\n## Risks\n- Cache invalidation\n- Migration downtime`;
    state
      .addPlanReview({
        id,
        content,
        filePath: "/tmp/sample-plan.md",
        timeoutMs: 345_600_000,
        sessionId,
        sessionName,
      })
      .catch(() => {});
    broadcast({
      type: "plan-review",
      id,
      content,
      filePath: "/tmp/sample-plan.md",
      timeoutMs: 345_600_000,
      sessionId,
      sessionName,
    });
    res.json({ pushed: true, id, sessionId, sessionName });
  });

  app.get("/debug/push-question", (_req, res) => {
    const id = `debug_${Date.now()}`;
    const msg = {
      type: "question" as const,
      id,
      questions: [{ question: "Debug: browser received?", header: "Debug", options: [{ label: "received", description: "WS ok" }], multiSelect: false }],
      timeoutMs: 60_000,
    };
    const clientsConnected = hasClients();
    broadcast(msg);
    res.json({ pushed: true, clientsConnected, id });
  });
}

const hooksConfigPath = join(__dirname, "..", "..", "hooks", "hooks.json");
if (existsSync(hooksConfigPath)) {
  try {
    const cfg = JSON.parse(readFileSync(hooksConfigPath, "utf-8"));
    if (cfg.settings?.questionRoutingEnabled != null) {
      state.questionRoutingEnabled = Boolean(cfg.settings.questionRoutingEnabled);
    }
  } catch {
    // invalid config — use defaults
  }
}

const webDist = join(__dirname, "..", "..", "web", "dist");
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get("*", (_req, res) => {
    res.sendFile(join(webDist, "index.html"));
  });
}

const server = createServer(app);
setupWebSocket(server);

async function isPortFree(port: number): Promise<boolean> {
  const { createServer: createNetServer } = await import("node:net");
  return new Promise((resolve) => {
    const tester = createNetServer();
    tester.once("error", () => resolve(false));
    tester.listen(port, () => {
      tester.close(() => resolve(true));
    });
  });
}

async function findPort(): Promise<number> {
  for (let port = PORT_START; port <= PORT_END; port++) {
    if (await isPortFree(port)) {
      await new Promise<void>((resolve) => {
        server.listen(port, resolve);
      });
      return port;
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
