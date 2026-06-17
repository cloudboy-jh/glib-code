#!/usr/bin/env bun
/**
 * prepare-dist.ts
 * ─────────────────────────────────────────────────────────────────────────
 * After `bun build --packages external` produces dist/server.js, this script:
 *   1. Writes a minimal standalone package.json into dist/ with only the
 *      runtime deps that server.js needs at require() time.
 *   2. Runs `npm install --production` inside dist/ to get a real flat
 *      node_modules that works anywhere bun is installed — no workspace
 *      symlinks, no path assumptions.
 *
 * The result: dist/ is a fully self-contained directory that can be copied
 * anywhere and run with `bun dist/server.js`.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(import.meta.dir, "..");
const DIST = join(ROOT, "dist");

mkdirSync(DIST, { recursive: true });

// Read current versions from the workspace package.json so we stay in sync
const serverPkg = JSON.parse(await Bun.file(join(ROOT, "package.json")).text());
const deps = serverPkg.dependencies as Record<string, string>;

// Standalone package.json — only runtime deps, no workspace: refs
const standalonePkg = {
  name: "glib-code-server",
  version: serverPkg.version,
  type: "module",
  dependencies: {
    "@hono/zod-validator":          deps["@hono/zod-validator"],
    "@mariozechner/pi-coding-agent": deps["@mariozechner/pi-coding-agent"],
    "gittrix":                       deps["gittrix"],
    "hono":                          deps["hono"],
    "simple-git":                    deps["simple-git"],
    "zod":                           deps["zod"],
  },
};

writeFileSync(
  join(DIST, "package.json"),
  JSON.stringify(standalonePkg, null, 2)
);

console.log("  ✓ wrote dist/package.json");

// npm install --production inside dist/
// Use npm (not bun) so we get a real flat node_modules — not workspace symlinks
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npm, ["install", "--omit=dev"], {
  cwd: DIST,
  stdio: "inherit",
  env: { ...process.env },
});

if (result.status !== 0) {
  console.error("npm install failed in dist/");
  process.exit(1);
}

console.log("  ✓ dist/node_modules installed");
console.log("  ✓ server bundle ready at dist/");
