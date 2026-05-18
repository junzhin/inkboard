import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Bundled defaults ship inside the plugin; user overrides live in XDG config
// dir so a plugin update (which `git pull`s the marketplace clone) never
// stomps user toggles.
export const bundledConfigPath = join(__dirname, "..", "..", "hooks", "hooks.json");
export const userConfigDir = join(homedir(), ".config", "inkboard");
export const userConfigPath = join(userConfigDir, "config.json");

export interface Settings {
  questionRoutingEnabled?: boolean;
}

function readJson(path: string): { settings?: Settings } | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

export function loadSettings(): Settings {
  const bundled = readJson(bundledConfigPath)?.settings ?? {};
  const user = readJson(userConfigPath)?.settings ?? {};
  return { ...bundled, ...user };
}

export function saveUserConfig(patch: Settings): void {
  try {
    mkdirSync(userConfigDir, { recursive: true });
    const current = readJson(userConfigPath) ?? { settings: {} };
    const merged = {
      ...current,
      settings: { ...(current.settings ?? {}), ...patch },
    };
    writeFileSync(userConfigPath, JSON.stringify(merged, null, 2));
  } catch (err) {
    process.stderr.write(`[inkboard] failed to persist user config: ${err}\n`);
  }
}
