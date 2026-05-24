import { createRequire } from 'module'; const require = createRequire(import.meta.url);

// src/hooks/session-start-hook.ts
import { existsSync as existsSync2, readFileSync as readFileSync2 } from "node:fs";
import { spawn as spawn2 } from "node:child_process";
import { platform } from "node:os";

// src/hooks/hook-bridge.ts
import { readFileSync, existsSync, appendFileSync, openSync, unlinkSync, closeSync, statSync, constants as fsConstants } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
var PID_FILE = "/tmp/inkboard.pid";
var PORT_FILE = "/tmp/inkboard.port";
var LOCK_FILE = "/tmp/inkboard-start.lock";
var APP_TAG = "inkboard";
var HOST = "127.0.0.1";
var PORT_TRUST_MS = 5 * 6e4;
var FINGERPRINT_TIMEOUT_MS = 300;
function makeDebug(logFile) {
  return (msg) => {
    try {
      appendFileSync(logFile, `${(/* @__PURE__ */ new Date()).toISOString()} ${msg}
`);
    } catch {
    }
  };
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
    const t = setTimeout(() => ctrl.abort(), FINGERPRINT_TIMEOUT_MS);
    const res = await fetch(`http://${HOST}:${port}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return false;
    const body = await res.json();
    return body.app === APP_TAG;
  } catch {
    return false;
  }
}
function isLikelyAlive(port) {
  if (port <= 0) return false;
  if (!existsSync(PID_FILE) || !existsSync(PORT_FILE)) return false;
  if (!isProcessAlive(PID_FILE)) return false;
  try {
    const age = Date.now() - statSync(PORT_FILE).mtimeMs;
    return age < PORT_TRUST_MS;
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
async function waitForReady(debug2, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    await sleep(250);
    if (!existsSync(PORT_FILE) || !isProcessAlive(PID_FILE)) continue;
    const port = parseInt(readFileSync(PORT_FILE, "utf-8").trim(), 10);
    if (port && await fingerprintHealthy(port)) {
      debug2(`ready after ${(i + 1) * 250}ms port=${port}`);
      return true;
    }
  }
  debug2("waitForReady timed out");
  return false;
}
async function lazyStart(debug2) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const indexJs = join(__dirname, "..", "index.js");
  if (!existsSync(indexJs)) {
    debug2(`index.js not found at ${indexJs}`);
    return false;
  }
  const lockFd = tryAcquireLock();
  if (lockFd == null) {
    debug2("another hook holds start lock \u2014 waiting for server to come up");
    return waitForReady(debug2);
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
      debug2(`spawned server pid=${child.pid}`);
    } catch (err) {
      debug2(`spawn failed: ${err}`);
      return false;
    }
    return await waitForReady(debug2);
  } finally {
    releaseLock(lockFd);
  }
}

// src/hooks/session-start-hook.ts
var debug = makeDebug("/tmp/inkboard-session-start.log");
function openBrowser(url) {
  if (process.env.INKBOARD_NO_BROWSER === "1") return;
  const os = platform();
  let cmd;
  let args;
  if (os === "darwin") {
    cmd = "open";
    args = [url];
  } else if (os === "win32") {
    cmd = "cmd";
    args = ["/c", "start", "", url];
  } else {
    const isWSL = existsSync2("/proc/version") && readFileSync2("/proc/version", "utf-8").toLowerCase().includes("microsoft");
    cmd = isWSL ? "wslview" : "xdg-open";
    args = [url];
  }
  try {
    const child = spawn2(cmd, args, { detached: true, stdio: "ignore" });
    child.unref();
    child.on("error", () => {
    });
  } catch {
  }
}
async function main() {
  debug("SessionStart hook fired");
  let port = parseInt(process.env.INKBOARD_PORT ?? "", 10);
  if (!port && existsSync2(PORT_FILE)) {
    port = parseInt(readFileSync2(PORT_FILE, "utf-8").trim(), 10);
  }
  let alive = port > 0 && isLikelyAlive(port);
  if (!alive && port > 0) {
    alive = await fingerprintHealthy(port);
  }
  if (!alive) {
    debug("server not running, starting...");
    const started = await lazyStart(debug);
    if (!started) {
      debug("lazy start failed");
      process.stderr.write("[inkboard] Canvas server failed to start. Run /inkboard to retry.\n");
      process.exit(0);
    }
    if (existsSync2(PORT_FILE)) {
      port = parseInt(readFileSync2(PORT_FILE, "utf-8").trim(), 10);
    }
  }
  if (!port) {
    debug("no port after start");
    process.exit(0);
  }
  const url = `http://localhost:${port}`;
  debug(`server ready at ${url}`);
  process.stderr.write(`[inkboard] Canvas ready \u2192 ${url}
`);
  openBrowser(url);
  process.exit(0);
}
main().catch((err) => {
  debug(`fatal: ${err}`);
  process.exit(0);
});
