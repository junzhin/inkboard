import { readFileSync, existsSync, appendFileSync } from "node:fs";

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

export async function bridgeHook(
  endpoint: string,
  opts: BridgeOptions = {}
): Promise<void> {
  const fallback = opts.fallback ?? "{}";
  const timeoutMs = opts.timeoutMs ?? 54_000;
  const debug = makeDebug(opts.logFile ?? "/tmp/inkboard-hook-bridge.log");

  debug(`bridgeHook called: ${endpoint}`);

  if (!existsSync(PID_FILE)) {
    debug("no PID file, fallback");
    await new Promise<void>((resolve) =>
      process.stdout.write(fallback, () => resolve())
    );
    process.exit(0);
  }

  let port = 7777;
  if (existsSync(PORT_FILE)) {
    port = parseInt(readFileSync(PORT_FILE, "utf-8").trim(), 10);
  }
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
