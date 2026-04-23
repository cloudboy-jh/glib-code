import { Hono } from "hono";

export const attachmentsRoutes = new Hono()
  .post("/", (c) => c.json({ ok: false, message: "not implemented" }, 501))
  .get("/:id", (c) => c.json({ ok: false, message: "not implemented" }, 501))
  .delete("/:id", (c) => c.json({ ok: false, message: "not implemented" }, 501));
