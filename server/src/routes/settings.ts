import { Hono } from "hono";
import { getSettings, patchSettings, resetSettings } from "../services/state";

export const settingsRoutes = new Hono()
  .get("/", async (c) => c.json(await getSettings()))
  .patch("/", async (c) => {
    const partial = await c.req.json().catch(() => ({}));
    return c.json(await patchSettings(partial));
  })
  .post("/reset", async (c) => c.json(await resetSettings()));
