import { Hono } from "hono";
import { deleteSession, forkSession, getSession, listSessions, patchSessionMeta } from "../services/session-store";
import { getCurrentProjectId, getProjectById } from "../services/project-store";
import * as gittrixService from "../services/gittrix-service";
import { requiredProjectPath, resolveSession } from "../services/session-resolver";

function mustProject() {
  const projectId = getCurrentProjectId();
  if (!projectId) return null;
  return getProjectById(projectId);
}

function routeError(message: string, code: string, retryable = false) {
  return { ok: false, code, message, retryable };
}

function filesFromPatch(patch: string) {
  const files = new Set<string>();
  for (const match of patch.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)) files.add((match[2] || match[1] || "").trim());
  for (const match of patch.matchAll(/^\+\+\+\s+(?:b\/)?([^\t\n\r]+)$/gm)) {
    const file = (match[1] || "").trim();
    if (file && file !== "/dev/null") files.add(file);
  }
  return [...files].filter(Boolean);
}

export const sessionsRoutes = new Hono()
  .get("/", async (c) => {
    const project = mustProject();
    if (!project) return c.json([]);
    return c.json(await listSessions(project.path));
  })
  .get("/:id", async (c) => {
    const requestedProjectPath = requiredProjectPath(c.req.query("projectPath"));
    const { existing: doc } = await resolveSession(requestedProjectPath, c.req.param("id"));
    if (!doc) return c.json(routeError("not found", "SESSION_NOT_FOUND"), 404);
    return c.json(doc);
  })
  .post("/:id/fork", async (c) => {
    const project = mustProject();
    if (!project) return c.json(routeError("no project open", "NO_PROJECT_OPEN"), 400);
    const forked = await forkSession(project.path, c.req.param("id"));
    if (!forked) return c.json(routeError("not found", "SESSION_NOT_FOUND"), 404);
    return c.json(forked.meta, 201);
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const requestedProjectPath = requiredProjectPath(c.req.query("projectPath"));
    const { existing: doc, projectPath } = await resolveSession(requestedProjectPath, id);
    if (!projectPath) return c.json(routeError("not found", "SESSION_NOT_FOUND"), 404);
    await deleteSession(projectPath, id);
    if (doc?.meta.gittrixSessionId) {
      try {
        const project = getProjectById(doc.meta.projectId);
        await gittrixService.evict(projectPath, doc.meta.gittrixSessionId, project?.branch ?? "main");
      } catch {
        // best effort
      }
    }
    return c.json({ ok: true });
  })
  .get("/:id/diff", async (c) => {
    const requestedProjectPath = requiredProjectPath(c.req.query("projectPath"));
    const { existing: doc, projectPath } = await resolveSession(requestedProjectPath, c.req.param("id"));
    if (!doc) return c.json(routeError("not found", "SESSION_NOT_FOUND"), 404);
    if (!doc.meta.gittrixSessionId) return c.json(routeError("session has no gittrix mapping", "SESSION_NO_GITTRIX_MAPPING"), 400);
    const project = getProjectById(doc.meta.projectId);
    const patch = await gittrixService.diff(projectPath!, doc.meta.gittrixSessionId, project?.branch ?? "main");
    return c.json({ diff: patch, files: filesFromPatch(patch) });
  })
  .post("/:id/promote", async (c) => {
    const requestedProjectPath = requiredProjectPath(c.req.query("projectPath"));
    const { existing: doc, projectPath } = await resolveSession(requestedProjectPath, c.req.param("id"));
    if (!doc) return c.json(routeError("not found", "SESSION_NOT_FOUND"), 404);
    if (!doc.meta.gittrixSessionId) return c.json(routeError("session has no gittrix mapping", "SESSION_NO_GITTRIX_MAPPING"), 400);
    const project = getProjectById(doc.meta.projectId);

    const body = await c.req.json().catch(() => null) as {
      selector?: { mode: "all" } | { mode: "files"; files: string[] };
      strategy?: "auto" | "commit" | "branch" | "pr" | "patch";
      message?: string;
    } | null;

    if (!body?.selector) return c.json(routeError("selector required", "SELECTOR_REQUIRED"), 400);

    try {
      const result = await gittrixService.promote(
        projectPath!,
        doc.meta.gittrixSessionId,
        { selector: body.selector, strategy: body.strategy, message: body.message },
        project?.branch ?? "main"
      );
      return c.json(result);
    } catch (error) {
      const conflict = error as Partial<{ code: string; conflictingFiles: string[]; durableSha: string; baselineSha: string }>;
      if (conflict?.code === "BASELINE_CONFLICT") {
        return c.json(
          {
            ok: false,
            code: "BASELINE_CONFLICT",
            message: "baseline conflict",
            conflictingFiles: conflict.conflictingFiles ?? [],
            durableSha: conflict.durableSha,
            baselineSha: conflict.baselineSha
          },
          409
        );
      }
      return c.json(routeError(error instanceof Error ? error.message : "promote failed", "PROMOTE_FAILED", true), 500);
    }
  })
  .post("/:id/evict", async (c) => {
    const requestedProjectPath = requiredProjectPath(c.req.query("projectPath"));
    const { existing: doc, projectPath } = await resolveSession(requestedProjectPath, c.req.param("id"));
    if (!doc) return c.json(routeError("not found", "SESSION_NOT_FOUND"), 404);
    if (!doc.meta.gittrixSessionId) return c.json(routeError("session has no gittrix mapping", "SESSION_NO_GITTRIX_MAPPING"), 400);
    const project = getProjectById(doc.meta.projectId);
    await gittrixService.evict(projectPath!, doc.meta.gittrixSessionId, project?.branch ?? "main");
    return c.json({ ok: true });
  })
  .patch("/:id", async (c) => {
    const requestedProjectPath = requiredProjectPath(c.req.query("projectPath"));
    const { projectPath } = await resolveSession(requestedProjectPath, c.req.param("id"));
    if (!projectPath) return c.json(routeError("not found", "SESSION_NOT_FOUND"), 404);
    const body = await c.req.json().catch(() => null) as { title?: string; status?: "idle" | "running" | "aborted" | "error" | "done"; model?: string; provider?: string } | null;
    const patched = await patchSessionMeta(projectPath, c.req.param("id"), {
      title: body?.title,
      status: body?.status,
      model: body?.model,
      provider: body?.provider
    });
    if (!patched) return c.json(routeError("not found", "SESSION_NOT_FOUND"), 404);
    return c.json(patched);
  });
