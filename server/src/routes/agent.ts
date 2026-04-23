import { Hono } from "hono";

export const agentRoutes = new Hono()
  .post("/sessions", (c) => c.json({ ok: false, message: "not implemented" }, 501))
  .post("/sessions/:id/send", (c) => c.json({ ok: false, message: "not implemented" }, 501))
  .get("/sessions/:id/stream", (c) => c.json({ ok: false, message: "not implemented" }, 501))
  .delete("/sessions/:id/turn", (c) => c.json({ ok: false, message: "not implemented" }, 501))
  .delete("/sessions/:id", (c) => c.json({ ok: false, message: "not implemented" }, 501));
