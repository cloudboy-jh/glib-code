import { Hono } from "hono";
import { deleteSession, forkSession, getSession, listSessions, patchSessionMeta } from "../services/sessions";
import { getCurrentProjectId, getProjectById } from "../services/state";

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
    await deleteSession(project.path, c.req.param("id"));
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
