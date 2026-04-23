import { Hono } from "hono";
import { diffFiles, diffHunks, diffItems, packDiff } from "../services/diff";

export const diffRoutes = new Hono()
  .get("/sources", (c) => c.json([
    { id: "uncommitted", label: "Uncommitted", enabled: true },
    { id: "commits", label: "Commits", enabled: true },
    { id: "branches", label: "Branches", enabled: true },
    { id: "prs", label: "Pull requests", enabled: true }
  ]))
  .get("/items", async (c) => {
    const source = c.req.query("source") ?? "uncommitted";
    const limit = Number(c.req.query("limit") ?? "50");
    const items = await diffItems(source, Number.isFinite(limit) ? limit : 50);
    if (!items) return c.json({ ok: false, message: "no project open" }, 404);
    return c.json(items);
  })
  .get("/files", async (c) => {
    const source = c.req.query("source") ?? "uncommitted";
    const ref = c.req.query("ref");
    const files = await diffFiles(source, ref);
    if (!files) return c.json({ ok: false, message: "no project open" }, 404);
    return c.json(files);
  })
  .get("/hunks", async (c) => {
    const source = c.req.query("source") ?? "uncommitted";
    const ref = c.req.query("ref");
    const file = c.req.query("file");
    if (!file) return c.json({ ok: false, message: "file required" }, 400);
    const hunks = await diffHunks(source, file, ref);
    if (!hunks) return c.json({ ok: false, message: "no project open" }, 404);
    return c.json(hunks);
  })
  .post("/pack", async (c) => {
    const body = await c.req.json().catch(() => null) as { source?: string; ref?: string; file?: string } | null;
    const source = body?.source ?? "uncommitted";
    const packed = await packDiff(source, body?.ref, body?.file);
    if (!packed) return c.json({ ok: false, message: "no project open" }, 404);
    return c.json(packed);
  })
  .post("/branch-compare", (c) => c.json({ ok: false, message: "not implemented" }, 501));
