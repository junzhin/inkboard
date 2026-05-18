import { createRequire } from 'module'; const require = createRequire(import.meta.url);

// src/hooks/hook-bridge.ts
import { readFileSync, existsSync, appendFileSync, openSync, unlinkSync, closeSync, constants as fsConstants } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
var PID_FILE = "/tmp/inkboard.pid";
var PORT_FILE = "/tmp/inkboard.port";
var LOCK_FILE = "/tmp/inkboard-start.lock";
var APP_TAG = "inkboard";
var HOST = "127.0.0.1";
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
async function fingerprintHealthy(port) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 800);
    const res = await fetch(`http://${HOST}:${port}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return false;
    const body = await res.json();
    return body.app === APP_TAG;
  } catch {
    return false;
  }
}
function tryAcquireLock() {
  try {
    return openSync(LOCK_FILE, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY, 384);
  } catch {
    return null;
  }
}
function releaseLock(fd) {
  try {
    closeSync(fd);
  } catch {
  }
  try {
    unlinkSync(LOCK_FILE);
  } catch {
  }
}
async function waitForReady(debug, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    await sleep(250);
    if (!existsSync(PORT_FILE) || !isProcessAlive(PID_FILE)) continue;
    const port = parseInt(readFileSync(PORT_FILE, "utf-8").trim(), 10);
    if (port && await fingerprintHealthy(port)) {
      debug(`ready after ${(i + 1) * 250}ms port=${port}`);
      return true;
    }
  }
  debug("waitForReady timed out");
  return false;
}
async function lazyStart(debug) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const indexJs = join(__dirname, "..", "index.js");
  if (!existsSync(indexJs)) {
    debug(`index.js not found at ${indexJs}`);
    return false;
  }
  const lockFd = tryAcquireLock();
  if (lockFd == null) {
    debug("another hook holds start lock \u2014 waiting for server to come up");
    return waitForReady(debug);
  }
  try {
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
    return await waitForReady(debug);
  } finally {
    releaseLock(lockFd);
  }
}
async function bridgeHook(endpoint, opts = {}) {
  const fallback = opts.fallback ?? "{}";
  const timeoutMs = opts.timeoutMs ?? 54e3;
  const debug = makeDebug(opts.logFile ?? "/tmp/inkboard-hook-bridge.log");
  debug(`bridgeHook called: ${endpoint}`);
  let port = parseInt(process.env.INKBOARD_PORT ?? "", 10);
  if (!port && existsSync(PORT_FILE)) {
    port = parseInt(readFileSync(PORT_FILE, "utf-8").trim(), 10);
  }
  const alive = existsSync(PID_FILE) && isProcessAlive(PID_FILE) && port > 0 && await fingerprintHealthy(port);
  if (!alive) {
    if (port > 0) {
      debug(`fingerprint failed for port=${port}, restarting`);
    } else {
      debug("server not running, attempting lazy start");
    }
    const started = await lazyStart(debug);
    if (!started) {
      debug("lazy start failed, fallback");
      process.stderr.write(
        "[inkboard] server did not come up \u2014 falling back to terminal. Run `bash <(curl -fsSL https://raw.githubusercontent.com/junzhin/inkboard/main/scripts/uninstall.sh)` then reinstall if this persists.\n"
      );
      await new Promise(
        (resolve) => process.stdout.write(fallback, () => resolve())
      );
      process.exit(0);
    }
    if (existsSync(PORT_FILE)) {
      port = parseInt(readFileSync(PORT_FILE, "utf-8").trim(), 10);
    }
  }
  if (!port) {
    debug("no port available after lazy start \u2014 fatal");
    process.stderr.write("[inkboard] FATAL: no port file. Run /plugin uninstall inkboard && reinstall.\n");
    await new Promise(
      (resolve) => process.stdout.write(fallback, () => resolve())
    );
    process.exit(0);
  }
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
    const res = await fetch(`http://${HOST}:${port}${endpoint}`, {
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
