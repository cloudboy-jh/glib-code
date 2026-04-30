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

const app = new Hono();

app.use("*", cors());

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
  await bootState();
  Bun.serve({
    port,
    fetch: app.fetch
  });
  console.log(`ready http://127.0.0.1:${port}`);
}
