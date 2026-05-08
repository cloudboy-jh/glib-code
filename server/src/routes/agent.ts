import { Hono } from "hono";
import type { AgentEvent } from "@glib-code/shared/events/agent";
import { abortRunningTurn, broadcast, disposeRuntimeSession, runTurn, subscribe } from "../services/agent-runtime";
import { appendEvents, createSession, deleteSession, getSession, patchSessionMeta } from "../services/sessions";
import { getCurrentProjectId, getProjectById, getProjectOverride, getProvidersState, getSettings } from "../services/state";
import { getPiCapabilities } from "../services/pi-capabilities";
import * as gittrixService from "../services/gittrix";
import { diffItems, packDiff } from "../services/diff";
import { log, logError } from "../lib/log";

function mustProject() {
  const projectId = getCurrentProjectId();
  if (!projectId) return null;
  return getProjectById(projectId);
}

function requiredProjectPath(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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
  const chunks = [prompt];
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
    if (!project) return c.json({ ok: false, message: "no project open" }, 400);
    const body = await c.req.json().catch(() => null) as { title?: string; model?: string; provider?: string } | null;
    const [providerState, capabilities] = await Promise.all([getProvidersState(), getPiCapabilities()]);
    if (!capabilities.ok) return c.json({ ok: false, message: capabilities.error ?? "pi provider discovery failed" }, 503);
    const projectOverride = getProjectOverride(project.id);
    const requestedProvider = body?.provider || projectOverride?.provider || providerState.defaultProvider;
    const providerConfig = capabilities.providers.find((p) => p.id === requestedProvider);
    if (!providerConfig) return c.json({ ok: false, message: `provider "${requestedProvider}" is not available` }, 400);
    if (!providerConfig.hasAuth) return c.json({ ok: false, message: `provider "${requestedProvider}" needs a usable API key` }, 400);
    const requestedModel = body?.model || projectOverride?.model || providerState.defaultModel;
    if (providerConfig.modelIds.length > 0 && !providerConfig.modelIds.includes(requestedModel)) {
      return c.json({ ok: false, message: "model not supported by provider" }, 400);
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

    let gittrixMeta: { gittrixSessionId: string; ephemeralPath: string; baselineSha: string };
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
      baselineSha: gittrixMeta.baselineSha
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
    const projectPath = requiredProjectPath(body?.projectPath);
    if (!projectPath) return c.json({ ok: false, message: "projectPath required" }, 400);
    const existing = await getSession(projectPath, id);
    if (!existing) return c.json({ ok: false, message: "session not found" }, 404);

    const prompt = body?.prompt?.trim();
    if (!prompt) return c.json({ ok: false, message: "prompt required" }, 400);
    const capabilities = await getPiCapabilities();
    if (!capabilities.ok) return c.json({ ok: false, message: capabilities.error ?? "pi provider discovery failed" }, 503);
    const provider = capabilities.providers.find((p) => p.id === existing.meta.provider && p.hasAuth);
    if (!provider) return c.json({ ok: false, message: `session provider "${existing.meta.provider}" needs a usable API key` }, 400);
    if (provider.modelIds.length > 0 && !provider.modelIds.includes(existing.meta.model)) {
      return c.json({ ok: false, message: "session model is no longer available for provider" }, 400);
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

    const agentPrompt = await buildAgentPrompt(prompt, body?.context, projectPath);

    void runTurn({
      sessionId: id,
      turnId,
      cwd: existing.meta.ephemeralPath || projectPath,
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
    const projectPath = requiredProjectPath(c.req.query("projectPath"));
    if (!projectPath) return c.json({ ok: false, message: "projectPath required" }, 400);
    const existing = await getSession(projectPath, id);
    if (!existing) return c.json({ ok: false, message: "session not found" }, 404);

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

        log("agent", "sse open", { sessionId: id, replayEvents: existing.events.length });
        safeEnqueue(`event: ready\ndata: ${JSON.stringify({ sessionId: id })}\n\n`);
        for (const evt of existing.events) {
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
    const projectPath = requiredProjectPath(c.req.query("projectPath"));
    if (!projectPath) return c.json({ ok: false, message: "projectPath required" }, 400);
    const existing = await getSession(projectPath, id);
    if (!existing) return c.json({ ok: false, message: "session not found" }, 404);
    const turnId = abortRunningTurn(id);
    if (!turnId) return c.json({ ok: false, message: "no active turn" }, 404);
    const evt: AgentEvent = { type: "aborted", turnId, at: new Date().toISOString() };
    await appendEvents(projectPath, id, [evt, { type: "turn_end", turnId, reason: "aborted", at: new Date().toISOString() }]);
    await patchSessionMeta(projectPath, id, { status: "aborted" });
    return c.json({ ok: true, sessionId: id, turnId });
  })
  .delete("/sessions/:id", async (c) => {
    const id = c.req.param("id");
    const projectPath = requiredProjectPath(c.req.query("projectPath"));
    if (!projectPath) return c.json({ ok: false, message: "projectPath required" }, 400);
    abortRunningTurn(id);
    await disposeRuntimeSession(id);
    const session = await getSession(projectPath, id);
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
