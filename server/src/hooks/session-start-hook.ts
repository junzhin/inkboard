import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { platform } from "node:os";
import { isLikelyAlive, lazyStart, makeDebug, fingerprintHealthy, PORT_FILE } from "./hook-bridge.js";

const debug = makeDebug("/tmp/inkboard-session-start.log");

function openBrowser(url: string): void {
  if (process.env.INKBOARD_NO_BROWSER === "1") return;
  const os = platform();
  let cmd: string;
  let args: string[];
  if (os === "darwin") {
    cmd = "open";
    args = [url];
  } else if (os === "win32") {
    cmd = "cmd";
    args = ["/c", "start", "", url];
  } else {
    // WSL: prefer wslview, fallback xdg-open
    const isWSL = existsSync("/proc/version") &&
      readFileSync("/proc/version", "utf-8").toLowerCase().includes("microsoft");
    cmd = isWSL ? "wslview" : "xdg-open";
    args = [url];
  }
  try {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.unref();
    child.on("error", () => {});
  } catch {
    // browser open is best-effort
  }
}

async function main(): Promise<void> {
  debug("SessionStart hook fired");

  let port = parseInt(process.env.INKBOARD_PORT ?? "", 10);
  if (!port && existsSync(PORT_FILE)) {
    port = parseInt(readFileSync(PORT_FILE, "utf-8").trim(), 10);
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
    if (existsSync(PORT_FILE)) {
      port = parseInt(readFileSync(PORT_FILE, "utf-8").trim(), 10);
    }
  }

  if (!port) {
    debug("no port after start");
    process.exit(0);
  }

  const url = `http://localhost:${port}`;
  debug(`server ready at ${url}`);
  process.stderr.write(`[inkboard] Canvas ready → ${url}\n`);
  openBrowser(url);
  process.exit(0);
}

main().catch((err) => {
  debug(`fatal: ${err}`);
  process.exit(0);
});
