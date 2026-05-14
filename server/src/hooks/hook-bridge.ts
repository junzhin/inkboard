import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PID_FILE = "/tmp/inkboard.pid";
const PORT_FILE = "/tmp/inkboard.port";

export async function bridgeHook(endpoint: string): Promise<void> {
  if (!existsSync(PID_FILE)) {
    process.stdout.write("{}");
    process.exit(0);
  }

  let port = 7777;
  if (existsSync(PORT_FILE)) {
    port = parseInt(readFileSync(PORT_FILE, "utf-8").trim(), 10);
  }

  let stdin = "";
  for await (const chunk of process.stdin) {
    stdin += chunk;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 54_000);

    const res = await fetch(`http://localhost:${port}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: stdin,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const body = await res.text();
    process.stdout.write(body || "{}");

    const parsed = JSON.parse(body || "{}");
    if (parsed.decision === "block") {
      process.exit(2);
    }
    process.exit(0);
  } catch {
    process.stdout.write("{}");
    process.exit(0);
  }
}
