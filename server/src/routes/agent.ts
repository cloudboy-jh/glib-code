import { Hono } from "hono";
import type { AgentEvent } from "@glib-code/shared/events/agent";
import { abortRunningTurn, broadcast, disposeRuntimeSession, getRunningTurn, runTurn, subscribe } from "../services/agent-runtime";
import { appendEvents, createSession, deleteSession, getSession, patchSessionMeta } from "../services/session-store";
import { getProvidersState, getSettings } from "../services/settings-store";
import { getCurrentProjectId, getProjectById, getProjectOverride } from "../services/project-store";
import { requiredProjectPath, resolveAgentCwd, resolveSession } from "../services/session-resolver";
import { getPiCapabilities } from "../services/pi-capabilities";
import * as gittrixService from "../services/gittrix-service";
import { diffItems, packDiff } from "../services/diff";
import { log, logError } from "../lib/log";
import { routeError } from "../lib/route-error";

function mustProject() {
  const projectId = getCurrentProjectId();
  if (!projectId) return null;
  return getProjectById(projectId);
}

function sseEncode(event: AgentEvent) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

async function buildDiffsContext(prompt: string, projectPath?: string) {
  if (!/\bdiffs?\b/i.test(prompt)) return "";

  const wantsLastCommit = /\b(last|latest|previous|head)\s+commit\b/i.test(prompt) || /\bcommit\b/i.test(prompt);
  if (wantsLastCommit) {
    const commits = await diffItems("commits", 1, projectPath);
    const ref = Array.isArray(commits) ? commits[0]?.ref : undefined;
    if (!ref) return "";
    const packed = await packDiff("commits", ref, undefined, projectPath);
    if (!packed?.diff?.trim()) return "";
    return `Diffs tool result: last commit ${ref.slice(0, 7)}\n\n${packed.diff.trim()}`;
  }

  const packed = await packDiff("uncommitted", undefined, undefined, projectPath);
  if (!packed?.diff?.trim()) return "";
  return `Diffs tool result: working tree changes\n\n${packed.diff.trim()}`;
}

async function buildAgentPrompt(prompt: string, context?: string, projectPath?: string) {
  const chunks = [
    "Response rules: after using tools, always provide a concise final answer. Do not dump raw tool JSON, full diffs, or secret values into prose; summarize results and refer to files/changes by path. When editing files, do not add provenance comments, signatures, branding markers, or notes like \"edited by glib-code/gittrix/session\" unless the user explicitly asks for that text.",
    prompt
  ];
  const trimmedContext = context?.trim();
  if (trimmedContext) chunks.push(`Attached context:\n\n${trimmedContext}`);
  const diffsContext = await buildDiffsContext(prompt, projectPath).catch(() => "");
  if (diffsContext) chunks.push(diffsContext);
  return chunks.join("\n\n---\n\n");
}

function missingCloudflareConfig() {
  const missing: string[] = [];
  if (!(process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID)) missing.push("CLOUDFLARE_ACCOUNT_ID");
  if (!(process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN)) missing.push("CLOUDFLARE_API_TOKEN");
  return missing;
}

export const agentRoutes = new Hono()
  .post("/sessions", async (c) => {
    const project = mustProject();
    if (!project) return c.json(routeError("no project open", "NO_PROJECT_OPEN"), 400);
    const body = await c.req.json().catch(() => null) as { title?: string; model?: string; provider?: string } | null;
    const [providerState, capabilities] = await Promise.all([getProvidersState(), getPiCapabilities()]);
    if (!capabilities.ok) return c.json(routeError(capabilities.error ?? "pi provider discovery failed", "PI_CAPABILITIES_FAILED", true), 503);
    const projectOverride = getProjectOverride(project.id);
    const requestedProvider = body?.provider || projectOverride?.provider || providerState.defaultProvider;
    const providerConfig = capabilities.providers.find((p) => p.id === requestedProvider);
    if (!providerConfig) return c.json(routeError(`provider "${requestedProvider}" is not available`, "PROVIDER_NOT_AVAILABLE"), 400);
    if (!providerConfig.hasAuth) return c.json(routeError(`provider "${requestedProvider}" needs a usable API key`, "PROVIDER_AUTH_REQUIRED"), 400);
    const requestedModel = body?.model || projectOverride?.model || providerState.defaultModel;
    if (providerConfig.modelIds.length > 0 && !providerConfig.modelIds.includes(requestedModel)) {
      return c.json(routeError("model not supported by provider", "MODEL_NOT_SUPPORTED"), 400);
    }

    const runtimeSettings = await getSettings();
    if (runtimeSettings.ephemeralProvider === "cloudflare-artifacts") {
      const missing = missingCloudflareConfig();
      if (missing.length) {
        return c.json({
          ok: false,
          code: "GITTRIX_CLOUDFLARE_CONFIG_MISSING",
          message: `Cloudflare Artifacts selected but missing ${missing.join(", ")}. Switch Ephemeral Provider to Local workspace or set the missing variables.`
        }, 400);
      }
    }

    let gittrixMeta: { gittrixSessionId: string; ephemeralPath: string; baselineSha: string; isGitBacked: boolean; workspaceKind: "worktree" | "clone" | "copy" | "remote" };
    try {
      gittrixMeta = await gittrixService.startSession({
        projectPath: project.path,
        task: body?.title?.trim() || "New Session",
        branch: project.branch
      });
    } catch (error) {
      logError("agent", "failed to start gittrix session", error, { projectPath: project.path, branch: project.branch });
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ ok: false, code: "GITTRIX_SESSION_START_FAILED", message: `failed to start gittrix session: ${message}` }, 500);
    }

    const created = await createSession({
      projectId: project.id,
      projectPath: project.path,
      title: body?.title?.trim() || "New Session",
      model: requestedModel,
      provider: requestedProvider,
      gittrixSessionId: gittrixMeta.gittrixSessionId,
      ephemeralPath: gittrixMeta.ephemeralPath,
      baselineSha: gittrixMeta.baselineSha,
      isGitBacked: gittrixMeta.isGitBacked,
      workspaceKind: gittrixMeta.workspaceKind
    });
    const start: AgentEvent = {
      type: "session_start",
      sessionId: created.id,
      projectId: created.projectId,
      branch: project.branch,
      model: created.model,
      createdAt: created.createdAt
    };
    await appendEvents(project.path, created.id, [start]);
    return c.json(created, 201);
  })
  .post("/sessions/:id/send", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => null) as { prompt?: string; context?: string; attachments?: string[]; projectPath?: string } | null;
    const requestedProjectPath = requiredProjectPath(body?.projectPath);
    const { existing, projectPath } = await resolveSession(requestedProjectPath, id);
    if (!existing) return c.json(routeError("session not found", "SESSION_NOT_FOUND"), 404);

    const prompt = body?.prompt?.trim();
    if (!prompt) return c.json(routeError("prompt required", "PROMPT_REQUIRED"), 400);
    if (getRunningTurn(id)) return c.json(routeError("session already has a running turn", "TURN_ALREADY_RUNNING", true), 409);
    const capabilities = await getPiCapabilities();
    if (!capabilities.ok) return c.json(routeError(capabilities.error ?? "pi provider discovery failed", "PI_CAPABILITIES_FAILED", true), 503);
    const provider = capabilities.providers.find((p) => p.id === existing.meta.provider && p.hasAuth);
    if (!provider) return c.json(routeError(`session provider "${existing.meta.provider}" needs a usable API key`, "PROVIDER_AUTH_REQUIRED"), 400);
    if (provider.modelIds.length > 0 && !provider.modelIds.includes(existing.meta.model)) {
      return c.json(routeError("session model is no longer available for provider", "MODEL_NOT_AVAILABLE"), 400);
    }

    const turnId = `turn_${Date.now().toString(36)}`;
    const userEvent: AgentEvent = {
      type: "user_turn",
      turnId,
      prompt,
      context: body?.context,
      attachments: body?.attachments,
      at: new Date().toISOString()
    };

    await appendEvents(projectPath, id, [userEvent]);
    broadcast(id, userEvent);
    await patchSessionMeta(projectPath, id, { status: "running" });

    const agentCwd = resolveAgentCwd(projectPath, existing.meta.ephemeralPath, existing.meta.isGitBacked);
    const sessionContext = `Session repo metadata:\n- durable repo: ${projectPath}\n- agent cwd: ${agentCwd}\n- gittrix ephemeral workspace: ${existing.meta.ephemeralPath || "none"}\n- gittrix workspace kind: ${existing.meta.workspaceKind || "unknown"}\n- gittrix git-backed: ${existing.meta.isGitBacked === true ? "yes" : "no"}\n- baseline: ${existing.meta.baselineSha || "unknown"}`;
    const agentPrompt = await buildAgentPrompt(`${sessionContext}\n\n${prompt}`, body?.context, projectPath);

    void runTurn({
      sessionId: id,
      turnId,
      cwd: agentCwd,
      prompt: agentPrompt,
      model: existing.meta.model,
      provider: existing.meta.provider,
      onEvent: async (event) => {
        await appendEvents(projectPath, id, [event]);
        if (event.type === "turn_end") {
          await patchSessionMeta(projectPath, id, {
            status: event.reason === "error" ? "error" : event.reason === "aborted" ? "aborted" : "done"
          });
        }
      }
    }).catch((error) => logError("agent", "runTurn promise rejected", error, { sessionId: id, turnId }));

    return c.json({ ok: true, sessionId: id, turnId });
  })
  .get("/sessions/:id/stream", async (c) => {
    const id = c.req.param("id");
    const requestedProjectPath = requiredProjectPath(c.req.query("projectPath"));
    const { existing, projectPath } = await resolveSession(requestedProjectPath, id);
    if (!existing) return c.json(routeError("session not found", "SESSION_NOT_FOUND"), 404);

    const replayRaw = Number(c.req.query("replay") ?? "100");
    const replayLimit = Number.isFinite(replayRaw) ? Math.max(0, Math.min(500, Math.trunc(replayRaw))) : 100;
    const replayEvents = replayLimit > 0 ? existing.events.slice(-replayLimit) : [];

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        let closed = false;
        const safeEnqueue = (chunk: string) => {
          if (closed) return false;
          try {
            controller.enqueue(encoder.encode(chunk));
            return true;
          } catch (error) {
            closed = true;
            logError("agent", "sse enqueue failed", error, { sessionId: id });
            return false;
          }
        };

        log("agent", "sse open", { sessionId: id, replayEvents: replayEvents.length, replayLimit });
        safeEnqueue(`event: ready\ndata: ${JSON.stringify({ sessionId: id })}\n\n`);
        for (const evt of replayEvents) {
          if (!safeEnqueue(sseEncode(evt))) break;
        }
        const unsub = subscribe(id, (event) => {
          safeEnqueue(sseEncode(event));
        });
        const interval = setInterval(() => {
          safeEnqueue(`event: ping\ndata: {}\n\n`);
        }, 5000);
        const close = () => {
          if (closed) return;
          closed = true;
          clearInterval(interval);
          unsub();
          try {
            controller.close();
          } catch (error) {
            logError("agent", "sse close failed", error, { sessionId: id });
          }
          log("agent", "sse close", { sessionId: id });
        };
        c.req.raw.signal.addEventListener("abort", close);
      }
    });

    c.header("Content-Type", "text/event-stream");
    c.header("Cache-Control", "no-cache");
    c.header("Connection", "keep-alive");
    return c.body(stream);
  })
  .delete("/sessions/:id/turn", async (c) => {
    const id = c.req.param("id");
    const requestedProjectPath = requiredProjectPath(c.req.query("projectPath"));
    const { existing, projectPath } = await resolveSession(requestedProjectPath, id);
    if (!existing) return c.json(routeError("session not found", "SESSION_NOT_FOUND"), 404);
    const turnId = abortRunningTurn(id);
    if (!turnId) return c.json(routeError("no active turn", "NO_ACTIVE_TURN"), 404);
    const evt: AgentEvent = { type: "aborted", turnId, at: new Date().toISOString() };
    await appendEvents(projectPath, id, [evt, { type: "turn_end", turnId, reason: "aborted", at: new Date().toISOString() }]);
    await patchSessionMeta(projectPath, id, { status: "aborted" });
    return c.json({ ok: true, sessionId: id, turnId });
  })
  .delete("/sessions/:id", async (c) => {
    const id = c.req.param("id");
    const requestedProjectPath = requiredProjectPath(c.req.query("projectPath"));
    const { existing: resolvedSession, projectPath } = await resolveSession(requestedProjectPath, id);
    if (!projectPath) return c.json(routeError("session not found", "SESSION_NOT_FOUND"), 404);
    abortRunningTurn(id);
    await disposeRuntimeSession(id);
    const session = resolvedSession ?? await getSession(projectPath, id);
    await deleteSession(projectPath, id);
    if (session?.meta.gittrixSessionId) {
      try {
        const project = getProjectById(session.meta.projectId);
        await gittrixService.evict(projectPath, session.meta.gittrixSessionId, project?.branch ?? "main");
      } catch {
        // best effort cleanup
      }
    }
    return c.json({ ok: true, id });
  });
