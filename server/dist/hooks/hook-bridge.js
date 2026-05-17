import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const PID_FILE = "/tmp/inkboard.pid";
const PORT_FILE = "/tmp/inkboard.port";
function makeDebug(logFile) {
    return (msg) => {
        try {
            appendFileSync(logFile, `${new Date().toISOString()} ${msg}\n`);
        }
        catch {
            // ignore
        }
    };
}
function readStdin() {
    return new Promise((resolve) => {
        let data = "";
        process.stdin.setEncoding("utf-8");
        process.stdin.on("data", (chunk) => (data += chunk));
        process.stdin.on("end", () => resolve(data));
        process.stdin.resume();
    });
}
function isProcessAlive(pidFile) {
    try {
        const pid = parseInt(readFileSync(pidFile, "utf-8").trim(), 10);
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
function lazyStart(debug) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const indexJs = join(__dirname, "..", "index.js");
    if (!existsSync(indexJs)) {
        debug(`index.js not found at ${indexJs}`);
        return false;
    }
    try {
        execSync(`node "${indexJs}" &`, {
            stdio: "ignore",
            timeout: 1000,
            shell: "/bin/bash",
        });
    }
    catch {
        // execSync throws on background process — expected
    }
    for (let i = 0; i < 6; i++) {
        execSync("sleep 0.5");
        if (existsSync(PORT_FILE) && isProcessAlive(PID_FILE)) {
            debug("lazy start succeeded");
            return true;
        }
    }
    debug("lazy start timed out");
    return false;
}
export async function bridgeHook(endpoint, opts = {}) {
    const fallback = opts.fallback ?? "{}";
    const timeoutMs = opts.timeoutMs ?? 54_000;
    const debug = makeDebug(opts.logFile ?? "/tmp/inkboard-hook-bridge.log");
    debug(`bridgeHook called: ${endpoint}`);
    const alive = existsSync(PID_FILE) && isProcessAlive(PID_FILE);
    if (!alive) {
        debug("server not running, attempting lazy start");
        const started = lazyStart(debug);
        if (!started) {
            debug("lazy start failed, fallback");
            await new Promise((resolve) => process.stdout.write(fallback, () => resolve()));
            process.exit(0);
        }
    }
    let port = parseInt(process.env.INKBOARD_PORT ?? "", 10);
    if (!port && existsSync(PORT_FILE)) {
        port = parseInt(readFileSync(PORT_FILE, "utf-8").trim(), 10);
    }
    if (!port)
        port = 7777;
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
        await new Promise((resolve) => process.stdout.write(body || fallback, () => resolve()));
        debug(isBlock ? "exit 0 (block via JSON stdout)" : "exit 0 (allow)");
        process.exit(0);
    }
    catch (err) {
        debug(`error: ${err}`);
        await new Promise((resolve) => process.stdout.write(fallback, () => resolve()));
        process.exit(0);
    }
}
//# sourceMappingURL=hook-bridge.js.map