import { Hono } from "hono";
import { gitBranches, gitLog, gitStatus } from "../services/git";

const notImplemented = (c: any) => c.json({ ok: false, message: "not implemented" }, 501);

export const gitRoutes = new Hono()
  .get("/status", async (c) => {
    const status = await gitStatus();
    if (!status) return c.json({ ok: false, message: "no project open" }, 404);
    return c.json(status);
  })
  .post("/stage", notImplemented)
  .post("/unstage", notImplemented)
  .post("/discard", notImplemented)
  .post("/commit", notImplemented)
  .post("/push", notImplemented)
  .post("/pull", notImplemented)
  .get("/branches", async (c) => {
    const branches = await gitBranches();
    if (!branches) return c.json({ ok: false, message: "no project open" }, 404);
    return c.json(branches);
  })
  .post("/checkout", notImplemented)
  .post("/branches", notImplemented)
  .get("/log", async (c) => {
    const limitRaw = c.req.query("limit");
    const limit = limitRaw ? Number(limitRaw) : 50;
    const logs = await gitLog(Number.isFinite(limit) ? limit : 50);
    if (!logs) return c.json({ ok: false, message: "no project open" }, 404);
    return c.json(logs);
  })
  .get("/commit/:sha", notImplemented);
