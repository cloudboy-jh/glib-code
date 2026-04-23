import { Hono } from "hono";
import { getCurrentProjectId, getProjectById, setCurrentProject } from "../services/state";

export const repoRoutes = new Hono()
  .get("/current", (c) => {
    const id = getCurrentProjectId();
    if (!id) return c.json({ ok: false, message: "no project open" }, 404);
    const project = getProjectById(id);
    if (!project) return c.json({ ok: false, message: "project not found" }, 404);
    return c.json(project);
  })
  .post("/switch", async (c) => {
    const body = await c.req.json().catch(() => null) as { id?: string } | null;
    if (!body?.id) return c.json({ ok: false, message: "id required" }, 400);
    const project = getProjectById(body.id);
    if (!project) return c.json({ ok: false, message: "project not found" }, 404);
    setCurrentProject(project.id);
    return c.json(project);
  });
