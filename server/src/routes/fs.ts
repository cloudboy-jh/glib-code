import { Hono } from "hono";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve, dirname, basename } from "node:path";
import { homedir } from "node:os";
import { getCurrentProjectId, getProjectById } from "../services/project-store";
import { inRepo } from "../lib/paths";

async function activeProjectPath() {
  const current = getCurrentProjectId();
  if (!current) return null;
  return getProjectById(current)?.path ?? null;
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

async function flattenPaths(root: string, base: string, relBase: string): Promise<string[]> {
  const names = await readdir(root);
  const out: string[] = [];
  for (const name of names) {
    if (name === ".git" || name === ".glib") continue;
    const full = join(root, name);
    const rel = relBase ? `${relBase}/${name}` : name;
    const s = await stat(full);
    if (s.isDirectory()) {
      out.push(`${rel}/`);
      out.push(...await flattenPaths(full, base, rel));
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
    const root = await activeProjectPath();
    if (!root) return c.json({ ok: false, message: "no project open" }, 404);

    const rel = c.req.query("path") ?? ".";
    const full = resolve(join(root, rel));
    if (!inRepo(root, full)) return c.json({ ok: false, message: "path escape blocked" }, 400);

    return c.json(await tree(full));
  })
  .get("/paths", async (c) => {
    const root = await activeProjectPath();
    if (!root) return c.json({ ok: false, message: "no project open" }, 404);

    const paths = await flattenPaths(root, root, "");
    return c.json({ ok: true, paths });
  })
  .get("/read", async (c) => {
    const root = await activeProjectPath();
    if (!root) return c.json({ ok: false, message: "no project open" }, 404);

    const rel = c.req.query("path");
    if (!rel) return c.json({ ok: false, message: "path required" }, 400);
    const full = resolve(join(root, rel));
    if (!inRepo(root, full)) return c.json({ ok: false, message: "path escape blocked" }, 400);

    const content = await readFile(full, "utf8");
    return c.json({ content, encoding: "utf8" });
  });
