import { Hono } from "hono";
import { createProject, forgetProject, initProject, openProject } from "../services/projects";
import {
  getRecents,
  putRecent,
  removeRecent,
  registerProject,
  setCurrentProject,
  setProjectOverride,
  getProjectById
} from "../services/state";
import { inspectRecentPath } from "../services/projects";
import { getPiCapabilities } from "../services/pi-capabilities";

export const projectsRoutes = new Hono()
  .get("/recents", async (c) => c.json(await getRecents()))
  .get("/recents/status", async (c) => {
    const recents = await getRecents();
    return c.json(
      recents.map((recent) => ({
        id: recent.id,
        status: inspectRecentPath(recent.path)
      }))
    );
  })
  .post("/open", async (c) => {
    const body = await c.req.json().catch(() => null) as { path?: string } | null;
    if (!body?.path) return c.json({ ok: false, message: "path required" }, 400);
    const result = await openProject(body.path);
    if (!result.ok) return c.json({ needsInit: true });
    registerProject(result.project);
    setCurrentProject(result.project.id);
    await putRecent({ id: result.project.id, name: result.project.name, path: result.project.path });
    return c.json(result.project);
  })
  .post("/init", async (c) => {
    const body = await c.req.json().catch(() => null) as { path?: string } | null;
    if (!body?.path) return c.json({ ok: false, message: "path required" }, 400);
    const result = await initProject(body.path);
    if (!result.ok) return c.json({ ok: false, message: "init failed" }, 500);
    registerProject(result.project);
    setCurrentProject(result.project.id);
    await putRecent({ id: result.project.id, name: result.project.name, path: result.project.path });
    return c.json(result.project);
  })
  .post("/create", async (c) => {
    const body = await c.req.json().catch(() => null) as { parent?: string; name?: string } | null;
    if (!body?.parent || !body?.name) return c.json({ ok: false, message: "parent and name required" }, 400);
    const result = await createProject(body.parent, body.name);
    if (!result.ok) return c.json({ ok: false, message: "create failed" }, 500);
    registerProject(result.project);
    setCurrentProject(result.project.id);
    await putRecent({ id: result.project.id, name: result.project.name, path: result.project.path });
    return c.json(result.project);
  })
  .delete("/recents/:id", async (c) => {
    await removeRecent(c.req.param("id"));
    return c.json({ ok: true });
  })
  .post("/recents/:id/forget", async (c) => {
    const id = c.req.param("id");
    const recents = await getRecents();
    const target = recents.find((r) => r.id === id);
    if (target) {
      await forgetProject(target.path);
      await removeRecent(id);
    }
    return c.json({ ok: true, id: target?.id ?? id });
  })
  .patch("/:id/provider", async (c) => {
    const id = c.req.param("id");
    const project = getProjectById(id);
    if (!project) return c.json({ ok: false, message: "project not found" }, 404);
    const body = await c.req.json().catch(() => null) as { provider?: string; model?: string } | null;
    const capabilities = await getPiCapabilities();
    if (!capabilities.ok) return c.json({ ok: false, message: capabilities.error ?? "pi provider discovery failed" }, 503);
    if (body?.provider) {
      const provider = capabilities.providers.find((p) => p.id === body.provider && p.hasAuth);
      if (!provider) return c.json({ ok: false, message: "provider not available in pi" }, 400);
      if (body.model && provider.modelIds.length > 0 && !provider.modelIds.includes(body.model)) {
        return c.json({ ok: false, message: "model not supported by provider" }, 400);
      }
    }
    const next = setProjectOverride(id, { provider: body?.provider, model: body?.model });
    return c.json({ ok: true, id, override: next });
  });
