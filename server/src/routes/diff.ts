import { Hono } from "hono";
import { branchCompare, diffFiles, diffItems, packDiff } from "../services/diff";

export const diffRoutes = new Hono()
  .get("/sources", (c) => c.json([
    { id: "uncommitted", label: "Uncommitted", enabled: true },
    { id: "commits", label: "Commits", enabled: true },
    { id: "branches", label: "Branches", enabled: true },
    { id: "prs", label: "Pull requests", enabled: false, reason: "Requires branch compare/source-control support." }
  ]))
  .get("/items", async (c) => {
    const source = c.req.query("source") ?? "uncommitted";
    const limit = Number(c.req.query("limit") ?? "50");
    const items = await diffItems(source, Number.isFinite(limit) ? limit : 50, c.req.query("projectPath"));
    if (!items) return c.json({ ok: false, message: "no project open" }, 404);
    return c.json(items);
  })
  .get("/files", async (c) => {
    const source = c.req.query("source") ?? "uncommitted";
    const ref = c.req.query("ref");
    const files = await diffFiles(source, ref, c.req.query("projectPath"));
    if (!files) return c.json({ ok: false, message: "no project open" }, 404);
    return c.json(files);
  })
  .post("/pack", async (c) => {
    const body = await c.req.json().catch(() => null) as { source?: string; ref?: string; file?: string; projectPath?: string } | null;
    const source = body?.source ?? "uncommitted";
    const packed = await packDiff(source, body?.ref, body?.file, body?.projectPath);
    if (!packed) return c.json({ ok: false, message: "no project open" }, 404);
    return c.json(packed);
  })
  .post("/branch-compare", async (c) => {
    const body = await c.req.json().catch(() => null) as { base?: string; head?: string; projectPath?: string } | null;
    const base = body?.base?.trim();
    const head = body?.head?.trim();
    if (!base || !head) return c.json({ ok: false, message: "base and head required" }, 400);
    const result = await branchCompare(base, head, body?.projectPath);
    if (!result) return c.json({ ok: false, message: "no project open" }, 404);
    if (!result.ok) return c.json({ ok: false, message: `ref not found: ${result.ref}`, code: "BAD_REF", ref: result.ref }, 400);
    return c.json(result);
  });
