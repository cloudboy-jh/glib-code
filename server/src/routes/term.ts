import { Hono } from "hono";

export const termRoutes = new Hono().get("/", (c) => c.json({ ok: false, message: "ws not implemented" }, 501));
