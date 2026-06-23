import { Hono } from "hono";
import { gitBranches, gitCheckout, gitCommit, gitCommitDetail, gitCreateBranch, gitDiscard, gitLog, gitPull, gitPush, gitStage, gitStash, gitStatus, gitUnstage } from "../services/git";
import { routeError } from "../lib/route-error";

export const gitRoutes = new Hono()
  .get("/status", async (c) => {
    const status = await gitStatus(c.req.query("projectPath"));
    if (!status) return c.json({ ok: false, message: "no project open" }, 404);
    return c.json(status);
  })
  .post("/stage", async (c) => {
    const body = await c.req.json().catch(() => null) as { files?: string[]; projectPath?: string } | null;
    try {
      const result = await gitStage(body?.files, body?.projectPath);
      if (!result) return c.json(routeError("no project open", "NO_PROJECT_OPEN"), 404);
      return c.json(result);
    } catch (error) {
      const e = error as Error & { code?: string; files?: string[] };
      if (e.code === "PROTECTED_PATH") return c.json({ ...routeError(e.message, e.code), files: e.files ?? [] }, 400);
      return c.json(routeError(e.message || "stage failed", e.code || "GIT_FAILED", true), 500);
    }
  })
  .post("/unstage", async (c) => {
    const body = await c.req.json().catch(() => null) as { files?: string[]; projectPath?: string } | null;
    try {
      const result = await gitUnstage(body?.files, body?.projectPath);
      if (!result) return c.json(routeError("no project open", "NO_PROJECT_OPEN"), 404);
      return c.json(result);
    } catch (error) {
      const e = error as Error & { code?: string };
      if (e.code === "INVALID_INPUT") return c.json(routeError(e.message, e.code), 400);
      return c.json(routeError(e.message || "unstage failed", e.code || "GIT_FAILED", true), 500);
    }
  })
  .post("/discard", async (c) => {
    const body = await c.req.json().catch(() => null) as { files?: string[]; projectPath?: string } | null;
    try {
      const result = await gitDiscard(body?.files, body?.projectPath);
      if (!result) return c.json(routeError("no project open", "NO_PROJECT_OPEN"), 404);
      return c.json(result);
    } catch (error) {
      const e = error as Error & { code?: string; files?: string[] };
      if (e.code === "INVALID_INPUT") return c.json(routeError(e.message, e.code), 400);
      if (e.code === "PROTECTED_PATH") return c.json({ ...routeError(e.message, e.code), files: e.files ?? [] }, 400);
      return c.json(routeError(e.message || "discard failed", e.code || "GIT_FAILED", true), 500);
    }
  })
  .post("/commit", async (c) => {
    const body = await c.req.json().catch(() => null) as { message?: string; files?: string[]; projectPath?: string } | null;
    try {
      const result = await gitCommit(body?.message || "", body?.files, body?.projectPath);
      if (!result) return c.json(routeError("no project open", "NO_PROJECT_OPEN"), 404);
      return c.json(result);
    } catch (error) {
      const e = error as Error & { code?: string; files?: string[] };
      if (e.code === "MESSAGE_REQUIRED" || e.code === "NOTHING_TO_COMMIT" || e.code === "PROTECTED_PATH") {
        if (e.code === "PROTECTED_PATH") return c.json({ ...routeError(e.message, e.code), files: e.files ?? [] }, 400);
        return c.json(routeError(e.message, e.code), 400);
      }
      return c.json(routeError(e.message || "commit failed", e.code || "GIT_FAILED", true), 500);
    }
  })
  .post("/push", async (c) => {
    const body = await c.req.json().catch(() => null) as { projectPath?: string } | null;
    try {
      const result = await gitPush(body?.projectPath);
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
    const body = await c.req.json().catch(() => null) as { message?: string; projectPath?: string } | null;
    try {
      const result = await gitStash(body?.message, body?.projectPath);
      if (!result) return c.json(routeError("no project open", "NO_PROJECT_OPEN"), 404);
      return c.json(result);
    } catch (error) {
      return c.json(routeError(error instanceof Error ? error.message : "stash failed", "STASH_FAILED", true), 500);
    }
  })
  .post("/pull", async (c) => {
    const body = await c.req.json().catch(() => null) as { projectPath?: string } | null;
    try {
      const result = await gitPull(body?.projectPath);
      if (!result) return c.json(routeError("no project open", "NO_PROJECT_OPEN"), 404);
      if (result.ok === false && (result as { code?: string }).code === "PULL_CONFLICT") {
        return c.json({ ...routeError("pull produced merge conflicts", "PULL_CONFLICT"), files: (result as { files?: string[] }).files ?? [] }, 409);
      }
      return c.json(result);
    } catch (error) {
      const code = (error as Error & { code?: string }).code;
      if (code === "NO_UPSTREAM" || code === "DETACHED_HEAD") return c.json(routeError(error instanceof Error ? error.message : "pull failed", code), 409);
      return c.json(routeError(error instanceof Error ? error.message : "pull failed", "PULL_FAILED", true), 500);
    }
  })
  .get("/branches", async (c) => {
    const branches = await gitBranches(c.req.query("projectPath"));
    if (!branches) return c.json({ ok: false, message: "no project open" }, 404);
    return c.json(branches);
  })
  .post("/checkout", async (c) => {
    const body = await c.req.json().catch(() => null) as { ref?: string; create?: boolean; projectPath?: string } | null;
    try {
      const result = await gitCheckout(body?.ref || "", body?.create === true, body?.projectPath);
      if (!result) return c.json(routeError("no project open", "NO_PROJECT_OPEN"), 404);
      return c.json(result);
    } catch (error) {
      const e = error as Error & { code?: string; files?: string[] };
      if (e.code === "INVALID_INPUT") return c.json(routeError(e.message, e.code), 400);
      if (e.code === "DIRTY_TREE") return c.json({ ...routeError(e.message, e.code), files: e.files ?? [] }, 409);
      return c.json(routeError(e.message || "checkout failed", e.code || "GIT_FAILED", true), 500);
    }
  })
  .post("/branches", async (c) => {
    const body = await c.req.json().catch(() => null) as { name?: string; from?: string; checkout?: boolean; projectPath?: string } | null;
    try {
      const result = await gitCreateBranch(body?.name || "", body?.from, body?.checkout === true, body?.projectPath);
      if (!result) return c.json(routeError("no project open", "NO_PROJECT_OPEN"), 404);
      return c.json(result);
    } catch (error) {
      const e = error as Error & { code?: string };
      if (e.code === "INVALID_INPUT") return c.json(routeError(e.message, e.code), 400);
      return c.json(routeError(e.message || "create branch failed", e.code || "GIT_FAILED", true), 500);
    }
  })
  .get("/log", async (c) => {
    const limitRaw = c.req.query("limit");
    const limit = limitRaw ? Number(limitRaw) : 50;
    const logs = await gitLog(Number.isFinite(limit) ? limit : 50, c.req.query("projectPath"));
    if (!logs) return c.json({ ok: false, message: "no project open" }, 404);
    return c.json(logs);
  })
  .get("/commit/:sha", async (c) => {
    const sha = c.req.param("sha");
    const result = await gitCommitDetail(sha, c.req.query("projectPath"));
    if (!result) return c.json(routeError("commit not found", "COMMIT_NOT_FOUND"), 404);
    return c.json(result);
  });
