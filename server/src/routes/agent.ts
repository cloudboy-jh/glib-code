import { Hono } from "hono";
import type { AgentEvent } from "@glib-code/shared/events/agent";
import { abortRunningTurn, broadcast, runTurn, subscribe } from "../services/agent-runtime";
import { appendEvents, createSession, deleteSession, getSession, patchSessionMeta } from "../services/sessions";
import { getCurrentProjectId, getProjectById, getProjectOverride, getProvidersState } from "../services/state";
import { getPiCapabilities } from "../services/pi-capabilities";
import * as gittrixService from "../services/gittrix";
import { log, logError } from "../lib/log";

function mustProject() {
  const projectId = getCurrentProjectId();
  if (!projectId) return null;
  return getProjectById(projectId);
}

function sseEncode(event: AgentEvent) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
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

    let gittrixMeta: { gittrixSessionId: string; ephemeralPath: string; baselineSha: string };
    try {
      gittrixMeta = await gittrixService.startSession({
        projectPath: project.path,
        task: body?.title?.trim() || "New Session",
        branch: project.branch
      });
    } catch {
      return c.json({ ok: false, message: "failed to start gittrix session" }, 500);
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
    const project = mustProject();
    if (!project) return c.json({ ok: false, message: "no project open" }, 400);
    const id = c.req.param("id");
    const existing = await getSession(project.path, id);
    if (!existing) return c.json({ ok: false, message: "session not found" }, 404);

    const body = await c.req.json().catch(() => null) as { prompt?: string; context?: string; attachments?: string[] } | null;
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

    await appendEvents(project.path, id, [userEvent]);
    broadcast(id, userEvent);
    await patchSessionMeta(project.path, id, { status: "running" });

    void runTurn({
      sessionId: id,
      turnId,
      cwd: existing.meta.ephemeralPath || project.path,
      prompt,
      model: existing.meta.model,
      provider: existing.meta.provider,
      onEvent: async (event) => {
        await appendEvents(project.path, id, [event]);
        if (event.type === "turn_end") {
          await patchSessionMeta(project.path, id, {
            status: event.reason === "error" ? "error" : event.reason === "aborted" ? "aborted" : "done"
          });
        }
      }
    }).catch((error) => logError("agent", "runTurn promise rejected", error, { sessionId: id, turnId }));

    return c.json({ ok: true, sessionId: id, turnId });
  })
  .get("/sessions/:id/stream", async (c) => {
    const project = mustProject();
    if (!project) return c.json({ ok: false, message: "no project open" }, 400);
    const id = c.req.param("id");
    const existing = await getSession(project.path, id);
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
    const project = mustProject();
    if (!project) return c.json({ ok: false, message: "no project open" }, 400);
    const id = c.req.param("id");
    const turnId = abortRunningTurn(id);
    if (!turnId) return c.json({ ok: false, message: "no active turn" }, 404);
    const evt: AgentEvent = { type: "aborted", turnId, at: new Date().toISOString() };
    await appendEvents(project.path, id, [evt, { type: "turn_end", turnId, reason: "aborted", at: new Date().toISOString() }]);
    await patchSessionMeta(project.path, id, { status: "aborted" });
    return c.json({ ok: true, sessionId: id, turnId });
  })
  .delete("/sessions/:id", async (c) => {
    const project = mustProject();
    if (!project) return c.json({ ok: false, message: "no project open" }, 400);
    const id = c.req.param("id");
    abortRunningTurn(id);
    const session = await getSession(project.path, id);
    await deleteSession(project.path, id);
    if (session?.meta.gittrixSessionId) {
      try {
        await gittrixService.evict(project.path, session.meta.gittrixSessionId, project.branch);
      } catch {
        // best effort cleanup
      }
    }
    return c.json({ ok: true, id });
  });
