import { readFileSync, existsSync, appendFileSync, openSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PID_FILE = "/tmp/inkboard.pid";
const PORT_FILE = "/tmp/inkboard.port";

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

async function lazyStart(debug: (msg: string) => void): Promise<boolean> {
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
      env: process.env,
    });
    child.unref();
    debug(`spawned server pid=${child.pid}`);
  } catch (err) {
    debug(`spawn failed: ${err}`);
    return false;
  }

  // 60 × 250ms = 15s total — first-time port probing can take a few seconds
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

export async function bridgeHook(
  endpoint: string,
  opts: BridgeOptions = {}
): Promise<void> {
  const fallback = opts.fallback ?? "{}";
  const timeoutMs = opts.timeoutMs ?? 54_000;
  const debug = makeDebug(opts.logFile ?? "/tmp/inkboard-hook-bridge.log");

  debug(`bridgeHook called: ${endpoint}`);

  const alive = existsSync(PID_FILE) && isProcessAlive(PID_FILE);

  if (!alive) {
    debug("server not running, attempting lazy start");
    const started = await lazyStart(debug);
    if (!started) {
      debug("lazy start failed, fallback");
      await new Promise<void>((resolve) =>
        process.stdout.write(fallback, () => resolve())
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

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`http://localhost:${port}${endpoint}`, {
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
