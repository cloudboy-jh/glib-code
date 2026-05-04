import { Hono } from "hono";
import { cors } from "hono/cors";
import { readinessRoutes } from "./routes/readiness";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { projectsRoutes } from "./routes/projects";
import { repoRoutes } from "./routes/repo";
import { diffRoutes } from "./routes/diff";
import { gitRoutes } from "./routes/git";
import { fsRoutes } from "./routes/fs";
import { agentRoutes } from "./routes/agent";
import { sessionsRoutes } from "./routes/sessions";
import { settingsRoutes } from "./routes/settings";
import { keybindingsRoutes } from "./routes/keybindings";
import { attachmentsRoutes } from "./routes/attachments";
import { termRoutes } from "./routes/term";
import { bootState } from "./services/state";
import { providersRoutes } from "./routes/providers";
import { log, logError } from "./lib/log";

const app = new Hono();

app.use("*", cors());
app.use("*", async (c, next) => {
  const started = performance.now();
  const method = c.req.method;
  const path = new URL(c.req.url).pathname;
  log("requests", "start", { method, path });

  try {
    await next();
    log("requests", "end", { method, path, status: c.res.status, durationMs: Math.round(performance.now() - started) });
  } catch (error) {
    logError("requests", "error", error, { method, path, durationMs: Math.round(performance.now() - started) });
    throw error;
  }
});

app.onError((error, c) => {
  logError("server", "unhandled route error", error, { method: c.req.method, path: new URL(c.req.url).pathname });
  return c.json({ ok: false, message: error.message || "internal server error" }, 500);
});

app.get("/", (c) => c.text("glib-code server"));
app.route("/api/readiness", readinessRoutes);
app.route("/api/health", healthRoutes);
app.route("/api/auth", authRoutes);
app.route("/api/projects", projectsRoutes);
app.route("/api/repo", repoRoutes);
app.route("/api/diff", diffRoutes);
app.route("/api/git", gitRoutes);
app.route("/api/fs", fsRoutes);
app.route("/api/agent", agentRoutes);
app.route("/api/sessions", sessionsRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/keybindings", keybindingsRoutes);
app.route("/api/attachments", attachmentsRoutes);
app.route("/api/term", termRoutes);
app.route("/api/providers", providersRoutes);

export type AppType = typeof app;

const portArg = process.argv.find((arg) => arg.startsWith("--port="));
const port = portArg ? Number(portArg.split("=")[1]) : 4173;

if (import.meta.main) {
  process.on("unhandledRejection", (error) => logError("server", "unhandled rejection", error));
  process.on("uncaughtException", (error) => logError("server", "uncaught exception", error));
  await bootState();
  Bun.serve({
    port,
    idleTimeout: 60,
    fetch: app.fetch
  });
  log("server", `ready http://127.0.0.1:${port}`);
}
