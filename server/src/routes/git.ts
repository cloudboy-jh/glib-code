import { Hono } from "hono";
import { gitBranches, gitLog, gitPush, gitStash, gitStatus } from "../services/git";

const notImplemented = (c: any) => c.json({ ok: false, message: "not implemented" }, 501);
const routeError = (message: string, code: string, retryable = false) => ({ ok: false, code, message, retryable });

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
  .post("/push", async (c) => {
    try {
      const result = await gitPush();
      if (!result) return c.json(routeError("no project open", "NO_PROJECT_OPEN"), 404);
      return c.json(result);
    } catch (error) {
      const code = (error as Error & { code?: string }).code;
      if (code === "NO_UPSTREAM") return c.json(routeError(error instanceof Error ? error.message : "no upstream", "NO_UPSTREAM"), 409);
      if (code === "DETACHED_HEAD") return c.json(routeError(error instanceof Error ? error.message : "detached head", "DETACHED_HEAD"), 409);
      return c.json(routeError(error instanceof Error ? error.message : "push failed", "PUSH_FAILED", true), 500);
    }
  })
  .post("/stash", async (c) => {
    const body = await c.req.json().catch(() => null) as { message?: string } | null;
    try {
      const result = await gitStash(body?.message);
      if (!result) return c.json(routeError("no project open", "NO_PROJECT_OPEN"), 404);
      return c.json(result);
    } catch (error) {
      return c.json(routeError(error instanceof Error ? error.message : "stash failed", "STASH_FAILED", true), 500);
    }
  })
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
