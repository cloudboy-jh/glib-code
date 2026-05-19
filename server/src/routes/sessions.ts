import { Hono } from "hono";
import { deleteSession, forkSession, getSession, listSessions, patchSessionMeta } from "../services/session-store";
import { getCurrentProjectId, getProjectById } from "../services/project-store";
import * as gittrixService from "../services/gittrix-service";
import { requiredProjectPath, resolveSession } from "../services/session-resolver";
import { logError } from "../lib/log";
import { getSettings } from "../services/settings-store";
import { abortRunningTurn, disposeRuntimeSession } from "../services/agent-runtime";
import { exportSessionDoc, parseExportFormat } from "../services/session-export";

function mustProject() {
  const projectId = getCurrentProjectId();
  if (!projectId) return null;
  return getProjectById(projectId);
}

function routeError(message: string, code: string, retryable = false) {
  return { ok: false, code, message, retryable };
}

function filesFromPatch(patch: string) {
  const files = new Set<string>();
  for (const match of patch.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)) files.add((match[2] || match[1] || "").trim());
  for (const match of patch.matchAll(/^\+\+\+\s+(?:b\/)?([^\t\n\r]+)$/gm)) {
    const file = (match[1] || "").trim();
    if (file && file !== "/dev/null") files.add(file);
  }
  return [...files].filter(Boolean);
}

async function durableDirtyFiles(projectPath: string) {
  const proc = Bun.spawn({ cmd: ["git", "status", "--porcelain=v1"], cwd: projectPath, stdout: "pipe", stderr: "pipe" });
  const code = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  if (code !== 0) return null;
  const files = new Set<string>();
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    const raw = line.slice(3).trim();
    const renamed = raw.includes(" -> ") ? raw.split(" -> ").pop() : raw;
    const normalized = renamed?.replace(/\\/g, "/");
    if (normalized && normalized !== ".glib" && !normalized.startsWith(".glib/")) files.add(normalized);
  }
  return [...files].sort((a, b) => a.localeCompare(b));
}

function dirtyFilesForSelector(files: string[], selector: { mode: "all" } | { mode: "files"; files: string[] }) {
  if (selector.mode === "all") return files;
  const selected = new Set(selector.files.map((file) => file.replace(/\\/g, "/")));
  return files.filter((file) => selected.has(file));
}

export const sessionsRoutes = new Hono()
  .get("/", async (c) => {
    const project = mustProject();
    if (!project) return c.json([]);
    return c.json(await listSessions(project.path));
  })
  .get("/:id", async (c) => {
    const requestedProjectPath = requiredProjectPath(c.req.query("projectPath"));
    const { existing: doc } = await resolveSession(requestedProjectPath, c.req.param("id"));
    if (!doc) return c.json(routeError("not found", "SESSION_NOT_FOUND"), 404);
    return c.json(doc);
  })
  .get("/:id/export", async (c) => {
    const requestedProjectPath = requiredProjectPath(c.req.query("projectPath"));
    const { existing: doc } = await resolveSession(requestedProjectPath, c.req.param("id"));
    if (!doc) return c.json(routeError("not found", "SESSION_NOT_FOUND"), 404);
    const format = parseExportFormat(c.req.query("format"));
    if (!format) return c.json(routeError("unsupported export format", "UNSUPPORTED_EXPORT_FORMAT"), 400);
    const result = exportSessionDoc(doc, format);
    c.header("Content-Type", result.contentType);
    c.header("Content-Disposition", `attachment; filename="${result.filename}"`);
    return c.body(result.body);
  })
  .post("/:id/fork", async (c) => {
    const project = mustProject();
    if (!project) return c.json(routeError("no project open", "NO_PROJECT_OPEN"), 400);
    const forked = await forkSession(project.path, c.req.param("id"));
    if (!forked) return c.json(routeError("not found", "SESSION_NOT_FOUND"), 404);
    return c.json(forked.meta, 201);
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const requestedProjectPath = requiredProjectPath(c.req.query("projectPath"));
    const { existing: doc, projectPath } = await resolveSession(requestedProjectPath, id);
    if (!projectPath) return c.json(routeError("not found", "SESSION_NOT_FOUND"), 404);
    abortRunningTurn(id);
    await disposeRuntimeSession(id);
    await deleteSession(projectPath, id);
    if (doc?.meta.gittrixSessionId) {
      try {
        const project = getProjectById(doc.meta.projectId);
        await gittrixService.evict(projectPath, doc.meta.gittrixSessionId, project?.branch ?? "main");
      } catch {
        // best effort
      }
    }
    return c.json({ ok: true });
  })
  .get("/:id/diff", async (c) => {
    const requestedProjectPath = requiredProjectPath(c.req.query("projectPath"));
    const { existing: doc, projectPath } = await resolveSession(requestedProjectPath, c.req.param("id"));
    if (!doc) return c.json(routeError("not found", "SESSION_NOT_FOUND"), 404);
    if (!doc.meta.gittrixSessionId) return c.json(routeError("session has no gittrix mapping", "SESSION_NO_GITTRIX_MAPPING"), 400);
    const project = getProjectById(doc.meta.projectId);
    try {
      const patch = await gittrixService.diff(projectPath!, doc.meta.gittrixSessionId, project?.branch ?? "main");
      return c.json({ diff: patch, files: filesFromPatch(patch) });
    } catch (error) {
      logError("server", "session diff failed", error, {
        sessionId: doc.meta.id,
        gittrixSessionId: doc.meta.gittrixSessionId,
        projectPath,
        ephemeralPath: doc.meta.ephemeralPath,
        workspaceKind: doc.meta.workspaceKind
      });
      return c.json(routeError(error instanceof Error ? error.message : "session diff failed", "DIFF_FAILED", true), 500);
    }
  })
  .post("/:id/promote", async (c) => {
    const requestedProjectPath = requiredProjectPath(c.req.query("projectPath"));
    const { existing: doc, projectPath } = await resolveSession(requestedProjectPath, c.req.param("id"));
    if (!doc) return c.json(routeError("not found", "SESSION_NOT_FOUND"), 404);
    if (!doc.meta.gittrixSessionId) return c.json(routeError("session has no gittrix mapping", "SESSION_NO_GITTRIX_MAPPING"), 400);
    const project = getProjectById(doc.meta.projectId);

    const body = await c.req.json().catch(() => null) as {
      selector?: { mode: "all" } | { mode: "files"; files: string[] };
      strategy?: "auto" | "commit" | "branch" | "pr" | "patch";
      message?: string;
    } | null;

    if (!body?.selector) return c.json(routeError("selector required", "SELECTOR_REQUIRED"), 400);

    const settings = await getSettings();
    if (settings.durableProvider === "local") {
      const dirty = await durableDirtyFiles(projectPath!);
      const blockedFiles = dirty ? dirtyFilesForSelector(dirty, body.selector) : [];
      if (blockedFiles.length) {
        return c.json(
          {
            ok: false,
            code: "DURABLE_REPO_DIRTY",
            message: body.selector.mode === "all"
              ? "durable repo has uncommitted changes; stash or commit them before committing session changes"
              : "selected files have uncommitted durable repo changes; stash or commit them before committing session changes",
            files: blockedFiles,
            retryable: true
          },
          409
        );
      }
    }

    try {
      const result = await gittrixService.promote(
        projectPath!,
        doc.meta.gittrixSessionId,
        { selector: body.selector, strategy: body.strategy, message: body.message },
        project?.branch ?? "main"
      );
      return c.json(result);
    } catch (error) {
      const conflict = error as Partial<{ code: string; conflictingFiles: string[]; durableSha: string; baselineSha: string }>;
      if (conflict?.code === "BASELINE_CONFLICT") {
        return c.json(
          {
            ok: false,
            code: "BASELINE_CONFLICT",
            message: "baseline conflict",
            conflictingFiles: conflict.conflictingFiles ?? [],
            durableSha: conflict.durableSha,
            baselineSha: conflict.baselineSha
          },
          409
        );
      }
      logError("server", "session promote failed", error, {
        sessionId: doc.meta.id,
        gittrixSessionId: doc.meta.gittrixSessionId,
        projectPath,
        ephemeralPath: doc.meta.ephemeralPath,
        workspaceKind: doc.meta.workspaceKind
      });
      return c.json(routeError(error instanceof Error ? error.message : "promote failed", "PROMOTE_FAILED", true), 500);
    }
  })
  .post("/:id/evict", async (c) => {
    const requestedProjectPath = requiredProjectPath(c.req.query("projectPath"));
    const { existing: doc, projectPath } = await resolveSession(requestedProjectPath, c.req.param("id"));
    if (!doc) return c.json(routeError("not found", "SESSION_NOT_FOUND"), 404);
    if (!doc.meta.gittrixSessionId) return c.json(routeError("session has no gittrix mapping", "SESSION_NO_GITTRIX_MAPPING"), 400);
    const project = getProjectById(doc.meta.projectId);
    await gittrixService.evict(projectPath!, doc.meta.gittrixSessionId, project?.branch ?? "main");
    return c.json({ ok: true });
  })
  .patch("/:id", async (c) => {
    const requestedProjectPath = requiredProjectPath(c.req.query("projectPath"));
    const { projectPath } = await resolveSession(requestedProjectPath, c.req.param("id"));
    if (!projectPath) return c.json(routeError("not found", "SESSION_NOT_FOUND"), 404);
    const body = await c.req.json().catch(() => null) as { title?: string; status?: "idle" | "running" | "aborted" | "error" | "done"; model?: string; provider?: string } | null;
    const patched = await patchSessionMeta(projectPath, c.req.param("id"), {
      title: body?.title,
      status: body?.status,
      model: body?.model,
      provider: body?.provider
    });
    if (!patched) return c.json(routeError("not found", "SESSION_NOT_FOUND"), 404);
    return c.json(patched);
  });
