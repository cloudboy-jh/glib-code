import { Hono } from "hono";
import { cors } from "hono/cors";
import { bootSettingsStore } from "./services/settings-store";
import { pruneStaleIndexEntries } from "./services/session-store";
import { loadProjectOverrides } from "./services/project-store";
import { mountApiRoutes } from "./routes";
import { log, logError } from "./lib/log";

const app = new Hono();

app.use("*", cors());
app.use("*", async (c, next) => {
  const started = performance.now();
  const method = c.req.method;
  const path = new URL(c.req.url).pathname;
  const reqId = Math.random().toString(36).slice(2, 8);
  log("requests", "start", { reqId, method, path });

  try {
    await next();
    log("requests", "end", { reqId, method, path, status: c.res.status, durationMs: Math.round(performance.now() - started) });
  } catch (error) {
    logError("requests", "error", error, { reqId, method, path, durationMs: Math.round(performance.now() - started) });
    throw error;
  }
});

app.onError((error, c) => {
  logError("server", "unhandled route error", error, { method: c.req.method, path: new URL(c.req.url).pathname });
  return c.json({ ok: false, message: error.message || "internal server error" }, 500);
});

app.get("/", (c) => c.text("glib-code server"));
mountApiRoutes(app);

export type AppType = typeof app;

const portArg = process.argv.find((arg) => arg.startsWith("--port="));
const port = portArg ? Number(portArg.split("=")[1]) : 4173;

if (import.meta.main) {
  process.on("unhandledRejection", (error) => logError("server", "unhandled rejection", error));
  process.on("uncaughtException", (error) => logError("server", "uncaught exception", error));
  await bootSettingsStore();
  await loadProjectOverrides().catch((error) => logError("server", "project overrides load failed", error));
  void pruneStaleIndexEntries().catch((error) => logError("server", "session index prune failed", error));
  Bun.serve({
    port,
    idleTimeout: 60,
    fetch: app.fetch
  });
  log("server", `ready http://127.0.0.1:${port}`);
}
