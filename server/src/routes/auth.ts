import { Hono } from "hono";

export const authRoutes = new Hono()
  .get("/session", (c) => c.json({ signedIn: false }))
  .post("/github", (c) => c.json({ ok: false, message: "not implemented" }, 501))
  .post("/signout", (c) => c.json({ ok: true }));
