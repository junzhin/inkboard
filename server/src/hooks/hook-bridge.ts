import { readFileSync, existsSync, appendFileSync, openSync, unlinkSync, closeSync, statSync, constants as fsConstants } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PID_FILE = "/tmp/inkboard.pid";
const PORT_FILE = "/tmp/inkboard.port";
const LOCK_FILE = "/tmp/inkboard-start.lock";
const APP_TAG = "inkboard";
const HOST = "127.0.0.1";
// PORT_FILE mtime newer than this is trusted without a /health fetch — keeps the
// fast path fast so Claude Code's native ExitPlanMode UI can't kill us mid-await.
const PORT_TRUST_MS = 5 * 60_000;
const FINGERPRINT_TIMEOUT_MS = 300;

interface BridgeOptions {
  /** Body written to stdout when the server is unreachable / errors. Default: `"{}"`. */
  fallback?: string;
  /** Abort the HTTP request after this many ms. Default: 54_000. */
  timeoutMs?: number;
  /** Log file path. Default: `/tmp/inkboard-hook-bridge.log`. */
  logFile?: string;
}

function makeDebug(logFile: string): (msg: string) => void {
  return (msg) => {
    try {
      appendFileSync(logFile, `${new Date().toISOString()} ${msg}\n`);
    } catch {
      // ignore
    }
  };
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.resume();
  });
}

function isProcessAlive(pidFile: string): boolean {
  try {
    const pid = parseInt(readFileSync(pidFile, "utf-8").trim(), 10);
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fingerprintHealthy(port: number): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FINGERPRINT_TIMEOUT_MS);
    const res = await fetch(`http://${HOST}:${port}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return false;
    const body = (await res.json()) as { app?: string };
    return body.app === APP_TAG;
  } catch {
    return false;
  }
}

/**
 * Fast liveness check. No I/O beyond local stat + kill(0).
 *
 * Why no /health round-trip here: Claude Code's native ExitPlanMode permission
 * UI runs *concurrently* with the PermissionRequest hook. If the user clicks the
 * native UI before our hook finishes its POST, Claude Code SIGTERMs our child
 * process. An 800ms /health probe lost that race in plan-review-hook.js, so the
 * canvas never got the broadcast. Trust a fresh PORT_FILE + live PID instead;
 * if those lie we fall through to fingerprintHealthy() in the slow path.
 */
function isLikelyAlive(port: number): boolean {
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

function tryAcquireLock(): number | null {
  try {
    return openSync(LOCK_FILE, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY, 0o600);
  } catch {
    return null;
  }
}

function releaseLock(fd: number): void {
  try { closeSync(fd); } catch { /* ignore */ }
  try { unlinkSync(LOCK_FILE); } catch { /* ignore */ }
}

async function waitForReady(debug: (msg: string) => void, attempts = 60): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    await sleep(250);
    if (!existsSync(PORT_FILE) || !isProcessAlive(PID_FILE)) continue;
    const port = parseInt(readFileSync(PORT_FILE, "utf-8").trim(), 10);
    if (port && (await fingerprintHealthy(port))) {
      debug(`ready after ${(i + 1) * 250}ms port=${port}`);
      return true;
    }
  }
  debug("waitForReady timed out");
  return false;
}

async function lazyStart(debug: (msg: string) => void): Promise<boolean> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const indexJs = join(__dirname, "..", "index.js");

  if (!existsSync(indexJs)) {
    debug(`index.js not found at ${indexJs}`);
    return false;
  }

  // Single-spawn lock — concurrent hooks share the same server instance.
  const lockFd = tryAcquireLock();
  if (lockFd == null) {
    debug("another hook holds start lock — waiting for server to come up");
    return waitForReady(debug);
  }

  try {
    try {
      const logFd = openSync("/tmp/inkboard-server.log", "a");
      const child = spawn(process.execPath, [indexJs], {
        detached: true,
        stdio: ["ignore", logFd, logFd],
        env: process.env,
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

export async function bridgeHook(
  endpoint: string,
  opts: BridgeOptions = {}
): Promise<void> {
  const fallback = opts.fallback ?? "{}";
  const timeoutMs = opts.timeoutMs ?? 54_000;
  const debug = makeDebug(opts.logFile ?? "/tmp/inkboard-hook-bridge.log");

  debug(`bridgeHook called: ${endpoint}`);

  let port = parseInt(process.env.INKBOARD_PORT ?? "", 10);
  if (!port && existsSync(PORT_FILE)) {
    port = parseInt(readFileSync(PORT_FILE, "utf-8").trim(), 10);
  }

  // Fast path: PID alive + PORT_FILE fresh ⇒ trust without /health probe. This
  // is what keeps us alive in the race with Claude Code's native ExitPlanMode
  // permission UI — the user can click reject in the native UI ~100ms after
  // hook spawn, so any pre-POST await we can skip, we should.
  let alive = isLikelyAlive(port);

  if (!alive) {
    // Slow path: PID/PORT untrusted — fingerprint and lazy-start if needed.
    if (port > 0 && (await fingerprintHealthy(port))) {
      alive = true;
    }
  }

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
        "[inkboard] server did not come up — falling back to terminal. Run `bash <(curl -fsSL https://raw.githubusercontent.com/junzhin/inkboard/main/scripts/uninstall.sh)` then reinstall if this persists.\n"
      );
      await new Promise<void>((resolve) =>
        process.stdout.write(fallback, () => resolve())
      );
      process.exit(0);
    }
    if (existsSync(PORT_FILE)) {
      port = parseInt(readFileSync(PORT_FILE, "utf-8").trim(), 10);
    }
  }

  if (!port) {
    debug("no port available after lazy start — fatal");
    process.stderr.write("[inkboard] FATAL: no port file. Run /plugin uninstall inkboard && reinstall.\n");
    await new Promise<void>((resolve) =>
      process.stdout.write(fallback, () => resolve())
    );
    process.exit(0);
  }
  debug(`port=${port}`);

  // Emit the user-visible hint BEFORE readStdin so even if Claude Code SIGTERMs
  // us mid-stdin we've already told the user where the canvas lives.
  const flowLabel = endpoint.includes("plan-review") ? "Plan review" : "Question";
  try {
    process.stderr.write(
      `[inkboard] ${flowLabel} sent to canvas → http://localhost:${port}\n`
    );
  } catch {
    // ignore
  }

  const stdin = await readStdin();
  debug(`stdin length=${stdin.length}`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`http://${HOST}:${port}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: stdin,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const body = await res.text();
    debug(`response status=${res.status} bytes=${body.length}`);

    const parsed = JSON.parse(body || "{}");
    const isBlock = parsed.decision === "block";

    await new Promise<void>((resolve) =>
      process.stdout.write(body || fallback, () => resolve())
    );

    debug(isBlock ? "exit 0 (block via JSON stdout)" : "exit 0 (allow)");
    process.exit(0);
  } catch (err) {
    debug(`error: ${err}`);
    await new Promise<void>((resolve) =>
      process.stdout.write(fallback, () => resolve())
    );
    process.exit(0);
  }
}
