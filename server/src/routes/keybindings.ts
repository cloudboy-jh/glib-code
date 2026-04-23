import { Hono } from "hono";
import { getKeybindings, resetKeybindings, setKeybindings } from "../services/state";

export const keybindingsRoutes = new Hono()
  .get("/", async (c) => c.json(await getKeybindings()))
  .put("/", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return c.json({ ok: false, error: "invalid payload" }, 400);
    }
    return c.json(await setKeybindings(body));
  })
  .post("/reset", async (c) => c.json(await resetKeybindings()));
