import { Hono } from "hono";
import { appendEvents, deleteSession, forkSession, getSession, listSessions, patchSessionMeta } from "../services/session-store";
import { fallbackProjectPath, getProjectById, getRecents, listRegisteredProjects } from "../services/project-store";
import * as gittrixService from "../services/gittrix-service";
import { requiredProjectPath, resolveSession } from "../services/session-resolver";
import { log, logError } from "../lib/log";
import { getSettings } from "../services/settings-store";
import { abortRunningTurn, broadcast, disposeRuntimeSession, getSessionStatsFromPi } from "../services/agent-runtime";
import { exportSessionDoc, parseExportFormat } from "../services/session-export";
import { routeError } from "../lib/route-error";
import { canonicalProjectPath } from "../lib/project-path";
import { clearBoundaryCache, computeBoundary, filesFromPatch, toBoundaryEvent } from "../services/boundary-service";
import type { SessionMeta } from "../services/session-store";

// Recompute the boundary for a session and broadcast it to connected SSE
// clients (also appended so it's replayable on reconnect). Best-effort —
// boundary failures must never break the originating request.
async function emitBoundary(meta: SessionMeta, projectPath: string) {
  try {
    clearBoundaryCache(meta.gittrixSessionId);
    const payload = await computeBoundary(meta, projectPath, { fresh: true });
    const event = toBoundaryEvent(meta.id, payload);
    await appendEvents(projectPath, meta.id, [event]).catch(() => undefined);
    broadcast(meta.id, event);
  } catch (error) {
    logError("server", "emitBoundary failed", error, { sessionId: meta.id });
  }
}

function mustProject(projectPath?: string) {
  if (projectPath && projectPath.trim()) return { path: projectPath.trim() };
  const fallback = fallbackProjectPath();
  return fallback ? { path: fallback } : null;
}

// 10s cache for the cross-project session listing. Invalidated on
// create/delete/fork so stale data never surfaces — the cache only saves
// redundant disk reads during rapid polling.
const SCOPE_ALL_CACHE_TTL_MS = 10_000;
let scopeAllCache: { at: number; value: SessionMeta[] } | null = null;

export function invalidateSessionListCache() {
  scopeAllCache = null;
}

async function listSessionsAcrossProjects() {
  if (scopeAllCache && Date.now() - scopeAllCache.at < SCOPE_ALL_CACHE_TTL_MS) {
    return scopeAllCache.value;
  }

  const paths = new Set<string>();
  const currentProject = mustProject();
  if (currentProject?.path) paths.add(currentProject.path);
  for (const project of listRegisteredProjects()) {
    if (project.path) paths.add(project.path);
  }
  const recents = await getRecents();
  for (const recent of recents) {
    if (recent.path) paths.add(recent.path);
  }

  const merged = new Map<string, SessionMeta>();
  for (const projectPath of paths) {
    const sessions = await listSessions(projectPath);
    for (const session of sessions) {
      const keyPath = canonicalProjectPath(session.projectPath) ?? session.projectPath;
      merged.set(`${keyPath}::${session.id}`, session);
    }
  }

  const value = [...merged.values()].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  scopeAllCache = { at: Date.now(), value };
  return value;
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
    const scope = c.req.query("scope");
    const startedAt = performance.now();
    const projectCount = listRegisteredProjects().length;

    if (scope === "all") {
      const all = await listSessionsAcrossProjects();
      const total = all.length;

      // Paginate only when limit/offset are explicitly provided. Without them,
      // return the full array (backward compatible with the frontend picker
      // which expects a flat array).
      const hasLimit = c.req.query("limit") !== undefined;
      const hasOffset = c.req.query("offset") !== undefined;
      let sessions = all;
      if (hasLimit || hasOffset) {
        const limitParam = Number(c.req.query("limit") ?? "50");
        const offsetParam = Number(c.req.query("offset") ?? "0");
        const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 200) : 50;
        const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? Math.floor(offsetParam) : 0;
        sessions = all.slice(offset, offset + limit);
      }

      const latencyMs = Math.round(performance.now() - startedAt);
      log("server", "session-list fetched", { scope: "all", projectCount, sessionCount: total, latencyMs });
      c.header("X-Total-Count", String(total));
      c.header("X-Has-More", String(hasLimit || hasOffset ? (sessions.length < total) : false));
      return c.json(sessions);
    }

    const project = mustProject(c.req.query("projectPath"));
    const result = project ? await listSessions(project.path) : [];
    const latencyMs = Math.round(performance.now() - startedAt);
    log("server", "session-list fetched", { scope: "project", projectCount, sessionCount: result.length, latencyMs });
    return c.json(result);
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
    const body = await c.req.json().catch(() => null) as { projectPath?: string } | null;
    const project = mustProject(body?.projectPath);
    if (!project) return c.json(routeError("no project open", "NO_PROJECT_OPEN"), 400);
    const forked = await forkSession(project.path, c.req.param("id"));
    if (!forked) return c.json(routeError("not found", "SESSION_NOT_FOUND"), 404);
    invalidateSessionListCache();
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
    invalidateSessionListCache();
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
      // Gittrix ephemeral diff is authoritative — no durable fallback (the
      // durable tree is shared across sessions; see boundary-service).
      const patch = await gittrixService.diff(projectPath!, doc.meta.gittrixSessionId, project?.branch ?? "main");
      return c.json({ diff: patch, files: filesFromPatch(patch) });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "SESSION_EXPIRED") {
        return c.json({ diff: "", files: [], alreadyPromoted: true, promotedSha: doc.meta.baselineSha ?? null });
      }
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
      // Get file count before promoting — the workspace is gone after promote.
      let fileCount = 0;
      if (body.selector.mode === "files") {
        fileCount = body.selector.files.length;
      } else {
        try {
          const boundary = await computeBoundary(doc.meta, projectPath!);
          fileCount = boundary.touchedFileCount;
        } catch {
          fileCount = 0;
        }
      }

      const result = await gittrixService.promote(
        projectPath!,
        doc.meta.gittrixSessionId,
        { selector: body.selector, strategy: body.strategy, message: body.message },
        project?.branch ?? "main"
      );
      const promotedSha = (result as { sha?: string | null } | null)?.sha ?? null;
      const nextHistory = [
        ...(doc.meta.promoteHistory ?? []),
        {
          at: new Date().toISOString(),
          fromSha: doc.meta.baselineSha ?? null,
          toSha: promotedSha,
          fileCount,
        },
      ];
      await patchSessionMeta(projectPath!, doc.meta.id, {
        status: "done",
        promoteHistory: nextHistory,
      }).catch(() => undefined);

      // Push a settled "promoted" boundary so all connected clients converge.
      clearBoundaryCache(doc.meta.gittrixSessionId);
      const promotedEvent = toBoundaryEvent(doc.meta.id, {
        state: "promoted",
        touchedFiles: [],
        touchedFileCount: 0,
        additions: 0,
        deletions: 0,
        baselineSha: doc.meta.baselineSha ?? null,
        lastPromotedAt: nextHistory.at(-1)?.at ?? null,
        promoteHistory: nextHistory,
      });
      await appendEvents(projectPath!, doc.meta.id, [promotedEvent]).catch(() => undefined);
      broadcast(doc.meta.id, promotedEvent);
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
  })
  .get("/:id/stats", async (c) => {
    const id = c.req.param("id");
    const requestedProjectPath = requiredProjectPath(c.req.query("projectPath"));
    const { existing: doc } = await resolveSession(requestedProjectPath, id);
    if (!doc) return c.json(routeError("not found", "SESSION_NOT_FOUND"), 404);
    const piStats = await getSessionStatsFromPi(id);
    return c.json({
      sessionId: id,
      totalCost: doc.meta.totalCost ?? 0,
      totalTokens: doc.meta.totalTokens ?? { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
      piStats
    });
  })
  .post("/:id/rename", async (c) => {
    const id = c.req.param("id");
    const requestedProjectPath = requiredProjectPath(c.req.query("projectPath"));
    const { projectPath } = await resolveSession(requestedProjectPath, id);
    if (!projectPath) return c.json(routeError("not found", "SESSION_NOT_FOUND"), 404);
    const body = await c.req.json().catch(() => null) as { title?: string } | null;
    const title = body?.title?.trim();
    if (!title) return c.json(routeError("title required", "TITLE_REQUIRED"), 400);
    const patched = await patchSessionMeta(projectPath, id, { title });
    if (!patched) return c.json(routeError("not found", "SESSION_NOT_FOUND"), 404);
    const { setSessionNameFromPi } = await import("../services/agent-runtime");
    await setSessionNameFromPi(id, title);
    return c.json(patched);
  })
  .post("/:id/compact", async (c) => {
    const id = c.req.param("id");
    const requestedProjectPath = requiredProjectPath(c.req.query("projectPath"));
    const { existing: doc } = await resolveSession(requestedProjectPath, id);
    if (!doc) return c.json(routeError("not found", "SESSION_NOT_FOUND"), 404);
    const body = await c.req.json().catch(() => null) as { customInstructions?: string } | null;
    const { compactSessionInPi } = await import("../services/agent-runtime");
    const result = await compactSessionInPi(id, body?.customInstructions);
    if (!result) return c.json(routeError("compaction failed or no pi session", "COMPACT_FAILED", true), 503);
    return c.json({ ok: true, result });
  })
  // ── Boundary state ────────────────────────────────────────────────────────
  // Hydration endpoint for the right-rail boundary zone. Live updates arrive via
  // the `boundary_changed` SSE event; this endpoint serves the initial state on
  // session load (and any client without an open stream). Derivation lives in
  // boundary-service.computeBoundary, which caches for 10s to debounce polls.
  .get("/:id/boundary", async (c) => {
    const requestedProjectPath = requiredProjectPath(c.req.query("projectPath"));
    const { existing: doc, projectPath } = await resolveSession(requestedProjectPath, c.req.param("id"));
    if (!doc) return c.json(routeError("not found", "SESSION_NOT_FOUND"), 404);

    try {
      const payload = await computeBoundary(doc.meta, projectPath!);
      return c.json(payload);
    } catch (error) {
      logError("server", "boundary check failed", error, {
        sessionId: doc.meta.id,
        gittrixSessionId: doc.meta.gittrixSessionId,
        projectPath,
      });
      return c.json(routeError(error instanceof Error ? error.message : "boundary check failed", "BOUNDARY_CHECK_FAILED", true), 500);
    }
  })
  // ── Discard ephemeral ─────────────────────────────────────────────────────
  // Evicts the ephemeral GitTrix workspace without deleting the glib session.
  // The session resets to idle; the next send will spin up a fresh workspace.
  // This is the "discard costs nothing" path from the spec — ephemeral empties,
  // durable is untouched.
  .post("/:id/discard", async (c) => {
    const requestedProjectPath = requiredProjectPath(c.req.query("projectPath"));
    const { existing: doc, projectPath } = await resolveSession(requestedProjectPath, c.req.param("id"));
    if (!doc) return c.json(routeError("not found", "SESSION_NOT_FOUND"), 404);
    if (!doc.meta.gittrixSessionId) return c.json(routeError("session has no gittrix workspace to discard", "SESSION_NO_GITTRIX_MAPPING"), 400);

    // Abort any running turn first — can't discard mid-run
    abortRunningTurn(c.req.param("id"));

    const project = getProjectById(doc.meta.projectId);
    try {
      await gittrixService.evict(projectPath!, doc.meta.gittrixSessionId, project?.branch ?? "main");
    } catch (error) {
      logError("server", "discard evict failed", error, {
        sessionId: doc.meta.id,
        gittrixSessionId: doc.meta.gittrixSessionId,
        projectPath,
      });
      return c.json(routeError(error instanceof Error ? error.message : "discard failed", "DISCARD_FAILED", true), 500);
    }

    // Clear the gittrix session from the stored meta so the boundary shows clean
    // and the next send will re-initialize a fresh ephemeral workspace.
    await patchSessionMeta(projectPath!, doc.meta.id, { status: "idle" } as any);

    // Bust the cache and push a clean boundary so all clients converge immediately.
    clearBoundaryCache(doc.meta.gittrixSessionId);
    const cleanEvent = toBoundaryEvent(doc.meta.id, {
      state: "clean",
      touchedFiles: [],
      touchedFileCount: 0,
      additions: 0,
      deletions: 0,
      baselineSha: doc.meta.baselineSha ?? null,
      lastPromotedAt: doc.meta.promoteHistory?.at(-1)?.at ?? null,
      promoteHistory: doc.meta.promoteHistory ?? [],
    });
    await appendEvents(projectPath!, doc.meta.id, [cleanEvent]).catch(() => undefined);
    broadcast(doc.meta.id, cleanEvent);

    return c.json({ ok: true, sessionId: doc.meta.id });
  });
