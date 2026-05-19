#!/usr/bin/env node
// Bundle server entry + hook scripts into self-contained .js files.
// Output goes to dist/ so plugin install can run without npm install.
import { build } from "esbuild";
import { rm, mkdir, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(__dirname, "..");
const distDir = join(serverRoot, "dist");

async function clean() {
  if (existsSync(distDir)) {
    await rm(distDir, { recursive: true, force: true });
  }
  await mkdir(distDir, { recursive: true });
  await mkdir(join(distDir, "hooks"), { recursive: true });
}

const sharedOpts = {
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  minify: false,
  sourcemap: false,
  // Node built-ins stay external (resolved at runtime).
  // npm packages get inlined.
  external: [],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  logLevel: "info",
};

async function bundleAll() {
  await build({
    ...sharedOpts,
    entryPoints: [join(serverRoot, "src/index.ts")],
    outfile: join(distDir, "index.js"),
  });

  await build({
    ...sharedOpts,
    entryPoints: [join(serverRoot, "src/hooks/question-hook.ts")],
    outfile: join(distDir, "hooks/question-hook.js"),
  });

  await build({
    ...sharedOpts,
    entryPoints: [join(serverRoot, "src/hooks/plan-review-hook.ts")],
    outfile: join(distDir, "hooks/plan-review-hook.js"),
  });

  await build({
    ...sharedOpts,
    entryPoints: [join(serverRoot, "src/hooks/plan-push-hook.ts")],
    outfile: join(distDir, "hooks/plan-push-hook.js"),
  });
}

async function main() {
  await clean();
  await bundleAll();
  console.log("[bundle] done. Output:", distDir);
}

main().catch((err) => {
  console.error("[bundle] failed:", err);
  process.exit(1);
});
