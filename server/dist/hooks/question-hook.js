import { createRequire } from 'module'; const require = createRequire(import.meta.url);

// src/hooks/hook-bridge.ts
import { readFileSync, existsSync, appendFileSync, openSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
var PID_FILE = "/tmp/inkboard.pid";
var PORT_FILE = "/tmp/inkboard.port";
function makeDebug(logFile) {
  return (msg) => {
    try {
      appendFileSync(logFile, `${(/* @__PURE__ */ new Date()).toISOString()} ${msg}
`);
    } catch {
    }
  };
}
function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => data += chunk);
    process.stdin.on("end", () => resolve(data));
    process.stdin.resume();
  });
}
function isProcessAlive(pidFile) {
  try {
    const pid = parseInt(readFileSync(pidFile, "utf-8").trim(), 10);
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function lazyStart(debug) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const indexJs = join(__dirname, "..", "index.js");
  if (!existsSync(indexJs)) {
    debug(`index.js not found at ${indexJs}`);
    return false;
  }
  try {
    const logFd = openSync("/tmp/inkboard-server.log", "a");
    const child = spawn(process.execPath, [indexJs], {
      detached: true,
      stdio: ["ignore", logFd, logFd],
      env: process.env
    });
    child.unref();
    debug(`spawned server pid=${child.pid}`);
  } catch (err) {
    debug(`spawn failed: ${err}`);
    return false;
  }
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    if (existsSync(PORT_FILE) && isProcessAlive(PID_FILE)) {
      debug(`lazy start succeeded after ${(i + 1) * 250}ms`);
      return true;
    }
  }
  debug("lazy start timed out");
  return false;
}
async function bridgeHook(endpoint, opts = {}) {
  const fallback = opts.fallback ?? "{}";
  const timeoutMs = opts.timeoutMs ?? 54e3;
  const debug = makeDebug(opts.logFile ?? "/tmp/inkboard-hook-bridge.log");
  debug(`bridgeHook called: ${endpoint}`);
  const alive = existsSync(PID_FILE) && isProcessAlive(PID_FILE);
  if (!alive) {
    debug("server not running, attempting lazy start");
    const started = await lazyStart(debug);
    if (!started) {
      debug("lazy start failed, fallback");
      await new Promise(
        (resolve) => process.stdout.write(fallback, () => resolve())
      );
      process.exit(0);
    }
  }
  let port = parseInt(process.env.INKBOARD_PORT ?? "", 10);
  if (!port && existsSync(PORT_FILE)) {
    port = parseInt(readFileSync(PORT_FILE, "utf-8").trim(), 10);
  }
  if (!port) port = 7777;
  debug(`port=${port}`);
  const stdin = await readStdin();
  debug(`stdin length=${stdin.length}`);
  const flowLabel = endpoint.includes("plan-review") ? "Plan review" : "Question";
  try {
    process.stderr.write(
      `[inkboard] ${flowLabel} sent to canvas \u2192 http://localhost:${port}
`
    );
  } catch {
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`http://localhost:${port}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: stdin,
      signal: controller.signal
    });
    clearTimeout(timeout);
    const body = await res.text();
    debug(`response status=${res.status} bytes=${body.length}`);
    const parsed = JSON.parse(body || "{}");
    const isBlock = parsed.decision === "block";
    await new Promise(
      (resolve) => process.stdout.write(body || fallback, () => resolve())
    );
    debug(isBlock ? "exit 0 (block via JSON stdout)" : "exit 0 (allow)");
    process.exit(0);
  } catch (err) {
    debug(`error: ${err}`);
    await new Promise(
      (resolve) => process.stdout.write(fallback, () => resolve())
    );
    process.exit(0);
  }
}

// src/hooks/question-hook.ts
bridgeHook("/hooks/question", { timeoutMs: 18e5 });
