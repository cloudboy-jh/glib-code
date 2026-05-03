import { Hono } from "hono";
import { deleteSession, forkSession, getSession, listSessions, patchSessionMeta } from "../services/sessions";
import { getCurrentProjectId, getProjectById } from "../services/state";
import * as gittrixService from "../services/gittrix";

function mustProject() {
  const projectId = getCurrentProjectId();
  if (!projectId) return null;
  return getProjectById(projectId);
}

export const sessionsRoutes = new Hono()
  .get("/", async (c) => {
    const project = mustProject();
    if (!project) return c.json([]);
    return c.json(await listSessions(project.path));
  })
  .get("/:id", async (c) => {
    const project = mustProject();
    if (!project) return c.json({ ok: false, message: "no project open" }, 400);
    const doc = await getSession(project.path, c.req.param("id"));
    if (!doc) return c.json({ ok: false, message: "not found" }, 404);
    return c.json(doc);
  })
  .post("/:id/fork", async (c) => {
    const project = mustProject();
    if (!project) return c.json({ ok: false, message: "no project open" }, 400);
    const forked = await forkSession(project.path, c.req.param("id"));
    if (!forked) return c.json({ ok: false, message: "not found" }, 404);
    return c.json(forked.meta, 201);
  })
  .delete("/:id", async (c) => {
    const project = mustProject();
    if (!project) return c.json({ ok: false, message: "no project open" }, 400);
    const id = c.req.param("id");
    const doc = await getSession(project.path, id);
    await deleteSession(project.path, id);
    if (doc?.meta.gittrixSessionId) {
      try {
        await gittrixService.evict(project.path, doc.meta.gittrixSessionId, project.branch);
      } catch {
        // best effort
      }
    }
    return c.json({ ok: true });
  })
  .get("/:id/diff", async (c) => {
    const project = mustProject();
    if (!project) return c.json({ ok: false, message: "no project open" }, 400);
    const doc = await getSession(project.path, c.req.param("id"));
    if (!doc) return c.json({ ok: false, message: "not found" }, 404);
    if (!doc.meta.gittrixSessionId) return c.json({ ok: false, message: "session has no gittrix mapping" }, 400);
    const patch = await gittrixService.diff(project.path, doc.meta.gittrixSessionId, project.branch);
    return c.json({ diff: patch });
  })
  .post("/:id/promote", async (c) => {
    const project = mustProject();
    if (!project) return c.json({ ok: false, message: "no project open" }, 400);
    const doc = await getSession(project.path, c.req.param("id"));
    if (!doc) return c.json({ ok: false, message: "not found" }, 404);
    if (!doc.meta.gittrixSessionId) return c.json({ ok: false, message: "session has no gittrix mapping" }, 400);

    const body = await c.req.json().catch(() => null) as {
      selector?: { mode: "all" } | { mode: "files"; files: string[] };
      strategy?: "auto" | "commit" | "branch" | "pr" | "patch";
      message?: string;
    } | null;

    if (!body?.selector) return c.json({ ok: false, message: "selector required" }, 400);

    try {
      const result = await gittrixService.promote(
        project.path,
        doc.meta.gittrixSessionId,
        { selector: body.selector, strategy: body.strategy, message: body.message },
        project.branch
      );
      return c.json(result);
    } catch (error) {
      const conflict = error as Partial<{ code: string; conflictingFiles: string[]; durableSha: string; baselineSha: string }>;
      if (conflict?.code === "BASELINE_CONFLICT") {
        return c.json(
          {
            code: "BASELINE_CONFLICT",
            conflictingFiles: conflict.conflictingFiles ?? [],
            durableSha: conflict.durableSha,
            baselineSha: conflict.baselineSha
          },
          409
        );
      }
      return c.json({ ok: false, message: error instanceof Error ? error.message : "promote failed" }, 500);
    }
  })
  .post("/:id/evict", async (c) => {
    const project = mustProject();
    if (!project) return c.json({ ok: false, message: "no project open" }, 400);
    const doc = await getSession(project.path, c.req.param("id"));
    if (!doc) return c.json({ ok: false, message: "not found" }, 404);
    if (!doc.meta.gittrixSessionId) return c.json({ ok: false, message: "session has no gittrix mapping" }, 400);
    await gittrixService.evict(project.path, doc.meta.gittrixSessionId, project.branch);
    return c.json({ ok: true });
  })
  .patch("/:id", async (c) => {
    const project = mustProject();
    if (!project) return c.json({ ok: false, message: "no project open" }, 400);
    const body = await c.req.json().catch(() => null) as { title?: string; status?: "idle" | "running" | "aborted" | "error" | "done"; model?: string; provider?: string } | null;
    const patched = await patchSessionMeta(project.path, c.req.param("id"), {
      title: body?.title,
      status: body?.status,
      model: body?.model,
      provider: body?.provider
    });
    if (!patched) return c.json({ ok: false, message: "not found" }, 404);
    return c.json(patched);
  });
