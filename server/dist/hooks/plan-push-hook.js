#!/usr/bin/env node
import { createRequire } from 'module'; const require = createRequire(import.meta.url);

// src/hooks/plan-push-hook.ts
import { existsSync as existsSync2, readdirSync, readFileSync as readFileSync2, statSync as statSync2, appendFileSync as appendFileSync2, writeFileSync } from "node:fs";
import { join as join2 } from "node:path";

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
async function bridgeHook(endpoint, opts = {}) {
  const fallback = opts.fallback ?? "{}";
  const timeoutMs = opts.timeoutMs ?? 54e3;
  const debug2 = makeDebug(opts.logFile ?? "/tmp/inkboard-hook-bridge.log");
  debug2(`bridgeHook called: ${endpoint}`);
  let port = parseInt(process.env.INKBOARD_PORT ?? "", 10);
  if (!port && existsSync(PORT_FILE)) {
    port = parseInt(readFileSync(PORT_FILE, "utf-8").trim(), 10);
  }
  let alive = isLikelyAlive(port);
  if (!alive) {
    if (port > 0 && await fingerprintHealthy(port)) {
      alive = true;
    }
  }
  if (!alive) {
    if (port > 0) {
      debug2(`fingerprint failed for port=${port}, restarting`);
    } else {
      debug2("server not running, attempting lazy start");
    }
    const started = await lazyStart(debug2);
    if (!started) {
      debug2("lazy start failed, fallback");
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
    debug2("no port available after lazy start \u2014 fatal");
    process.stderr.write("[inkboard] FATAL: no port file. Run /plugin uninstall inkboard && reinstall.\n");
    await new Promise(
      (resolve) => process.stdout.write(fallback, () => resolve())
    );
    process.exit(0);
  }
  debug2(`port=${port}`);
  const flowLabel = endpoint.includes("plan-review") ? "Plan review" : "Question";
  try {
    process.stderr.write(
      `[inkboard] ${flowLabel} sent to canvas \u2192 http://localhost:${port}
`
    );
  } catch {
  }
  const stdin = await readStdin();
  debug2(`stdin length=${stdin.length}`);
  const postBody = opts.transformBody ? await opts.transformBody(stdin) : stdin;
  if (postBody !== stdin) debug2(`transformBody produced ${postBody.length} bytes`);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`http://${HOST}:${port}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: postBody,
      signal: controller.signal
    });
    clearTimeout(timeout);
    const rawBody = await res.text();
    debug2(`response status=${res.status} bytes=${rawBody.length}`);
    const body = opts.transformResponse ? opts.transformResponse(rawBody) : rawBody;
    if (body !== rawBody) debug2(`transformResponse: ${rawBody.slice(0, 120)} \u2192 ${body.slice(0, 120)}`);
    const parsed = JSON.parse(body || "{}");
    const isBlock = parsed.decision === "block";
    await new Promise(
      (resolve) => process.stdout.write(body || fallback, () => resolve())
    );
    debug2(isBlock ? "exit 0 (block via JSON stdout)" : "exit 0 (allow)");
    process.exit(0);
  } catch (err) {
    debug2(`error: ${err}`);
    await new Promise(
      (resolve) => process.stdout.write(fallback, () => resolve())
    );
    process.exit(0);
  }
}

// src/hooks/plan-push-hook.ts
var LOG_FILE = "/tmp/inkboard-plan-push.log";
var APPROVED_MARKER_PREFIX = "/tmp/inkboard-plan-approved-";
var currentSessionId = "";
function debug(msg) {
  try {
    appendFileSync2(LOG_FILE, `${(/* @__PURE__ */ new Date()).toISOString()} [plan-push] ${msg}
`);
  } catch {
  }
}
function findLatestPlanFile(cwd) {
  const plansDir = join2(cwd, ".claude", "plans");
  if (!existsSync2(plansDir)) {
    debug(`plans dir not found: ${plansDir}`);
    return null;
  }
  const files = readdirSync(plansDir).filter((f) => f.endsWith(".md")).map((f) => {
    const p = join2(plansDir, f);
    return { path: p, mtime: statSync2(p).mtimeMs };
  }).sort((a, b) => b.mtime - a.mtime);
  if (files.length === 0) {
    debug("plans dir exists but no .md files");
    return null;
  }
  const best = files[0];
  const ageMs = Date.now() - best.mtime;
  debug(`best plan: ${best.path} age=${Math.round(ageMs / 1e3)}s`);
  return { content: readFileSync2(best.path, "utf-8"), path: best.path, mtime: best.mtime };
}
var PLAN_RECENCY_MS = 30 * 6e4;
function transformBody(stdin) {
  let input;
  try {
    input = JSON.parse(stdin);
  } catch {
    debug("JSON parse failed on stdin");
    return stdin;
  }
  currentSessionId = input.session_id ?? "";
  debug(`tool_name=${input.tool_name ?? "?"} cwd=${input.cwd ?? "?"} session=${input.session_id ?? "?"}`);
  const toolInput = input.tool_input ?? {};
  let plan = toolInput.plan ?? "";
  let filePath = toolInput.file_path;
  debug(`tool_input.plan length=${plan.length} file_path=${filePath ?? "none"}`);
  if (!plan.trim() && input.cwd) {
    const found = findLatestPlanFile(input.cwd);
    if (found && Date.now() - found.mtime < PLAN_RECENCY_MS) {
      plan = found.content;
      filePath = found.path;
      debug(`using plan file: ${filePath} (${plan.length} chars)`);
    } else if (found) {
      debug(`plan file too old: age=${Math.round((Date.now() - found.mtime) / 1e3)}s > ${PLAN_RECENCY_MS / 1e3}s`);
    }
  }
  if (!plan.trim()) {
    debug("no plan content found \u2014 passing stdin through unchanged");
    return stdin;
  }
  debug(`plan found (${plan.length} chars), enriching body for server`);
  return JSON.stringify({
    ...input,
    tool_input: { ...toolInput, plan, file_path: filePath },
    permission_request: { tool_input: { plan, file_path: filePath } }
  });
}
function transformResponse(body) {
  try {
    const parsed = JSON.parse(body);
    const behavior = parsed?.hookSpecificOutput?.decision?.behavior;
    const message = parsed?.hookSpecificOutput?.decision?.message;
    if (behavior === "deny") {
      debug(`decision=deny message=${message?.slice(0, 80) ?? "none"}`);
      return JSON.stringify({
        decision: "block",
        reason: message ?? "Changes requested in InkBoard canvas"
      });
    }
    debug(`decision=allow`);
    writeApprovedMarker();
    return "{}";
  } catch {
    debug("transformResponse parse error \u2014 allowing");
    writeApprovedMarker();
    return "{}";
  }
}
function writeApprovedMarker() {
  if (!currentSessionId) {
    debug("no session_id captured \u2014 skipping approval marker");
    return;
  }
  const path = `${APPROVED_MARKER_PREFIX}${currentSessionId}`;
  try {
    writeFileSync(path, String(Date.now()));
    debug(`wrote approval marker: ${path}`);
  } catch (err) {
    debug(`failed to write approval marker: ${err}`);
  }
}
bridgeHook("/hooks/plan-review", {
  fallback: "{}",
  timeoutMs: 18e5,
  logFile: LOG_FILE,
  transformBody,
  transformResponse
});
