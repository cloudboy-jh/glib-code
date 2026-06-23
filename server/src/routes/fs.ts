import { Hono } from "hono";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve, dirname, basename } from "node:path";
import { homedir } from "node:os";
import { fallbackProjectPath } from "../services/project-store";
import { inRepo } from "../lib/paths";

const MAX_PATH_COUNT = 10_000;
const MAX_READ_BYTES = 1_000_000;
const BINARY_SAMPLE_BYTES = 8_192;

async function activeProjectPath(projectPath?: string) {
  if (projectPath && projectPath.trim()) return projectPath.trim();
  return fallbackProjectPath();
}

async function tree(path: string): Promise<any> {
  const stats = await stat(path);
  if (!stats.isDirectory()) {
    return { name: path.split(/[\\/]/).pop(), path, type: "file" };
  }

  const names = await readdir(path);
  const children = await Promise.all(
    names
      .filter((n) => n !== ".git")
      .map(async (name) => {
        const child = join(path, name);
        const s = await stat(child);
        return {
          name,
          path: child,
          type: s.isDirectory() ? "directory" : "file"
        };
      })
  );

  return { name: path.split(/[\\/]/).pop(), path, type: "directory", children };
}

// Use `git ls-files` instead of a manual recursive walk — git-aware (skips
// ignored files, respects .gitignore), fast even in large repos. Falls back
// to the manual walk if git fails (non-repo or git missing).
async function flattenPaths(root: string, base: string, relBase: string): Promise<string[]> {
  // Try git ls-files first (fast, git-aware).
  try {
    const proc = Bun.spawn({ cmd: ["git", "ls-files"], cwd: root, stdout: "pipe", stderr: "pipe" });
    const code = await proc.exited;
    if (code === 0) {
      const out = await new Response(proc.stdout).text();
      const paths = out.split("\n").filter(Boolean);
      // Prepend directory markers for the tree view (paths ending in "/").
      const withDirs = new Set<string>();
      for (const p of paths) {
        const parts = p.split("/");
        for (let i = 1; i < parts.length; i++) {
          withDirs.add(`${parts.slice(0, i).join("/")}/`);
        }
        withDirs.add(p);
      }
      const all = [...withDirs].sort();
      if (all.length > MAX_PATH_COUNT) {
        return [...all.slice(0, MAX_PATH_COUNT), "... (truncated)"];
      }
      return all;
    }
  } catch {
    // fall through to manual walk
  }

  // Fallback: manual recursive walk (non-repo or git missing).
  return flattenPathsManual(root, base, relBase);
}

async function flattenPathsManual(root: string, base: string, relBase: string): Promise<string[]> {
  const names = await readdir(root);
  const out: string[] = [];
  for (const name of names) {
    if (name === ".git" || name === ".glib") continue;
    if (out.length > MAX_PATH_COUNT) {
      out.push("... (truncated)");
      return out;
    }
    const full = join(root, name);
    const rel = relBase ? `${relBase}/${name}` : name;
    const s = await stat(full);
    if (s.isDirectory()) {
      out.push(`${rel}/`);
      out.push(...await flattenPathsManual(full, base, rel));
    } else {
      out.push(rel);
    }
  }
  return out;
}

// ── Directory browser ──────────────────────────────────────────────────────
// Server-driven folder picker for flows that run before any project is open
// (clone destination, open project). The server owns filesystem truth — the
// browser cannot hand back a real absolute path — so navigation happens here.
// Sandboxed to the user's home dir; never lists above it.
type BrowseEntry = { name: string; path: string };
type BrowseResult = { path: string; parent: string | null; entries: BrowseEntry[] };

function browseRoot(): string {
  return homedir();
}

// Clamp a requested path into [home, ...]. Rejects Windows drive paths on POSIX
// (resolve() would mangle them) and anything that escapes above the home root.
function resolveBrowsePath(requested: string | undefined): string {
  const root = browseRoot();
  if (!requested || !requested.trim()) return root;
  const trimmed = requested.trim();
  if (process.platform !== "win32" && /^[a-zA-Z]:[\\/]/.test(trimmed)) return root;
  const full = resolve(trimmed);
  if (full === root || full.startsWith(`${root}/`)) return full;
  return root;
}

async function listDirectories(path: string): Promise<BrowseResult> {
  const root = browseRoot();
  const names = await readdir(path).catch(() => [] as string[]);
  const entries: BrowseEntry[] = [];
  for (const name of names) {
    if (name.startsWith(".")) continue; // hide dotfiles/dirs
    const child = join(path, name);
    const s = await stat(child).catch(() => null);
    if (s?.isDirectory()) entries.push({ name, path: child });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const parent = path === root ? null : dirname(path);
  return { path, parent, entries };
}

export const fsRoutes = new Hono()
  // Server-driven directory browser (clone destination / open project picker).
  .get("/browse", async (c) => {
    const target = resolveBrowsePath(c.req.query("path") ?? undefined);
    return c.json({ ok: true, ...(await listDirectories(target)) });
  })
  .get("/tree", async (c) => {
    const root = await activeProjectPath(c.req.query("projectPath"));
    if (!root) return c.json({ ok: false, message: "no project open" }, 404);

    const rel = c.req.query("path") ?? ".";
    const full = resolve(join(root, rel));
    if (!inRepo(root, full)) return c.json({ ok: false, message: "path escape blocked" }, 400);

    return c.json(await tree(full));
  })
  .get("/paths", async (c) => {
    const root = await activeProjectPath(c.req.query("projectPath"));
    if (!root) return c.json({ ok: false, message: "no project open" }, 404);

    const paths = await flattenPaths(root, root, "");
    return c.json({ ok: true, paths });
  })
  .get("/read", async (c) => {
    const root = await activeProjectPath(c.req.query("projectPath"));
    if (!root) return c.json({ ok: false, message: "no project open" }, 404);

    const rel = c.req.query("path");
    if (!rel) return c.json({ ok: false, message: "path required" }, 400);
    const full = resolve(join(root, rel));
    if (!inRepo(root, full)) return c.json({ ok: false, message: "path escape blocked" }, 400);

    // Size guard — reject files over 1MB.
    const s = await stat(full).catch(() => null);
    if (!s) return c.json({ ok: false, message: "file not found" }, 404);
    if (s.size > MAX_READ_BYTES) {
      return c.json({ ok: false, message: `file too large (${s.size} bytes, max ${MAX_READ_BYTES})` }, 413);
    }

    // Binary detection — check first 8KB for null bytes.
    const handle = await import("node:fs/promises").then((m) => m.open(full, "r"));
    try {
      const sample = new Uint8Array(Math.min(BINARY_SAMPLE_BYTES, s.size));
      await handle.read(sample, 0, sample.length, 0);
      if (sample.includes(0)) {
        return c.json({ ok: false, binary: true, message: "binary file" });
      }
    } finally {
      await handle.close();
    }

    const content = await readFile(full, "utf8");
    return c.json({ content, encoding: "utf8" });
  });
