import { Hono } from "hono";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getCurrentProjectId, getProjectById } from "../services/state";
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

export const fsRoutes = new Hono()
  .get("/tree", async (c) => {
    const root = await activeProjectPath();
    if (!root) return c.json({ ok: false, message: "no project open" }, 404);

    const rel = c.req.query("path") ?? ".";
    const full = resolve(join(root, rel));
    if (!inRepo(root, full)) return c.json({ ok: false, message: "path escape blocked" }, 400);

    return c.json(await tree(full));
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
