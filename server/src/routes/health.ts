import { Hono } from "hono";

const startedAt = Date.now();

export const healthRoutes = new Hono().get("/", (c) => {
  return c.json({
    ok: true,
    uptimeMs: Date.now() - startedAt,
    now: new Date().toISOString()
  });
});
