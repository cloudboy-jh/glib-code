import { Hono } from "hono";

export const sessionsRoutes = new Hono()
  .get("/", (c) => c.json([]))
  .get("/:id", (c) => c.json({ ok: false, message: "not found" }, 404))
  .post("/:id/fork", (c) => c.json({ ok: false, message: "not implemented" }, 501))
  .delete("/:id", (c) => c.json({ ok: false, message: "not implemented" }, 501))
  .patch("/:id", (c) => c.json({ ok: false, message: "not implemented" }, 501));
