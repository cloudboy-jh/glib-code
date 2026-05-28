import type { Hono } from "hono";
import { agentRoutes } from "./agent";
import { attachmentsRoutes } from "./attachments";
import { authRoutes } from "./auth";
import { diffRoutes } from "./diff";
import { fsRoutes } from "./fs";
import { gitRoutes } from "./git";
import { healthRoutes } from "./health";
import { keybindingsRoutes } from "./keybindings";
import { openRoutes } from "./open";
import { projectsRoutes } from "./projects";
import { providersRoutes } from "./providers";
import { readinessRoutes } from "./readiness";
import { repoRoutes } from "./repo";
import { sessionsRoutes } from "./sessions";
import { settingsRoutes } from "./settings";
import { termRoutes } from "./term";

export function mountApiRoutes(app: Hono) {
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
  app.route("/api/open", openRoutes);
}
