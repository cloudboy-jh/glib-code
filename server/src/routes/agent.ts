import { Hono } from "hono";
import type { AgentEvent, TokenUsage } from "@glib-code/shared/events/agent";
import { abortRunningTurn, broadcast, disposeRuntimeSession, getRunningTurn, onSessionInfoChanged, runTurn, subscribe } from "../services/agent-runtime";
import { appendEvents, createSession, deleteSession, getSession, patchSessionMeta } from "../services/session-store";
import { getProvidersState, getSettings } from "../services/settings-store";
import { getCurrentProjectId, getProjectById, getProjectByPath, getProjectOverride } from "../services/project-store";
import { projectIdFromPath } from "../services/projects";
import { requiredProjectPath, resolveAgentCwd, resolveSession } from "../services/session-resolver";
import { getPiCapabilities } from "../services/pi-capabilities";
import * as gittrixService from "../services/gittrix-service";
import { diffItems, packDiff } from "../services/diff";
import { clearBoundaryCache, computeBoundary, toBoundaryEvent } from "../services/boundary-service";
import { log, logError } from "../lib/log";
import { routeError } from "../lib/route-error";

// ── Boundary push scheduler ────────────────────────────────────────────────
// File-mutating tool calls fire rapidly during a turn. Coalesce boundary
// recomputes to at most one in flight per session, with a trailing recompute if
// another mutation lands while one is running. turn_end forces a final flush.
const boundaryRecomputePending = new Set<string>();
const boundaryRecomputeRunning = new Set<string>();

const MUTATING_TOOLS = new Set(["write", "edit", "bash"]);

async function recomputeAndBroadcastBoundary(sessionId: string, projectPath: string) {
  const result = await resolveSession(projectPath, sessionId);
  const doc = result.existing;
  if (!doc) return;
  clearBoundaryCache(doc.meta.gittrixSessionId);
  const payload = await computeBoundary(doc.meta, result.projectPath ?? projectPath, { fresh: true });
  const event = toBoundaryEvent(sessionId, payload);
  await appendEvents(result.projectPath ?? projectPath, sessionId, [event]).catch(() => undefined);
  broadcast(sessionId, event);
}

// Debounced trigger: recompute now if idle, otherwise mark a trailing pass.
function scheduleBoundaryRecompute(sessionId: string, projectPath: string) {
  if (boundaryRecomputeRunning.has(sessionId)) {
    boundaryRecomputePending.add(sessionId);
    return;
  }
  void runBoundaryRecompute(sessionId, projectPath);
}

async function runBoundaryRecompute(sessionId: string, projectPath: string) {
  boundaryRecomputeRunning.add(sessionId);
  try {
    do {
      boundaryRecomputePending.delete(sessionId);
      await recomputeAndBroadcastBoundary(sessionId, projectPath);
    } while (boundaryRecomputePending.has(sessionId));
  } catch (error) {
    logError("agent", "boundary recompute failed", error, { sessionId });
  } finally {
    boundaryRecomputeRunning.delete(sessionId);
  }
}

// Forces a final boundary recompute, waiting for any in-flight pass to settle.
async function flushBoundaryRecompute(sessionId: string, projectPath: string) {
  // Drain any in-flight loop first so we don't double-run concurrently.
  while (boundaryRecomputeRunning.has(sessionId)) {
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  await runBoundaryRecompute(sessionId, projectPath);
}

onSessionInfoChanged(async (sessionId, name) => {
  try {
    const { getSessionById, patchSessionMeta: patch } = await import("../services/session-store");
    const result = await getSessionById(sessionId);
    if (!result) return;
    await patch(result.projectPath, sessionId, { title: name });
    broadcast(sessionId, { type: "session_start", sessionId, projectId: "", branch: "", model: "", createdAt: new Date().toISOString() });
  } catch (error) {
    logError("agent", "failed to update session name from pi", error, { sessionId });
  }
});

function mustProject(projectPath?: string) {
  if (projectPath && projectPath.trim()) {
    const path = projectPath.trim();
    const registered = getProjectByPath(path);
    if (registered) return registered;
    // Not registered (e.g. multi-tab opened elsewhere): synthesize a stable
    // project so id-keyed lookups (overrides) and gittrix branch still work.
    return { id: projectIdFromPath(path), name: path.split(/[\\/]/).pop() || path, path, branch: "main", isGitRepo: true as const };
  }
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

function deriveSessionTitle(prompt: string): string {
  let title = prompt.trim();
  title = title.replace(/^##\s+My request for (?:Codex|glib-code|the agent):\s*/i, "");
  title = title.replace(/\n.*$/s, "");
  title = title.replace(/^["'`]+|["'`]+$/g, "");
  if (title.length > 80) {
    const cut = title.lastIndexOf(" ", 77);
    title = title.slice(0, cut > 0 ? cut : 77) + "…";
  }
  return title.trim() || "New Session";
}

export const agentRoutes = new Hono()
  .post("/sessions", async (c) => {
    const body = await c.req.json().catch(() => null) as { title?: string; model?: string; provider?: string; projectPath?: string } | null;
    const project = mustProject(body?.projectPath);
    if (!project) return c.json(routeError("no project open", "NO_PROJECT_OPEN"), 400);
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

    const existingDoc = await getSession(projectPath, id);
    if (existingDoc && (existingDoc.meta.title === "New Session" || !existingDoc.meta.title.trim())) {
      const derivedTitle = deriveSessionTitle(prompt);
      if (derivedTitle) {
        await patchSessionMeta(projectPath, id, { title: derivedTitle });
      }
    }

    await patchSessionMeta(projectPath, id, { status: "running" });

    const agentCwd = resolveAgentCwd(projectPath, existing.meta.ephemeralPath, existing.meta.isGitBacked);
    // Do NOT expose the durable repo path to the agent. It runs inside an
    // isolated ephemeral workspace (agentCwd); leaking the durable path makes
    // the model edit there with absolute paths, bypassing isolation so changes
    // never land in the workspace the diff/promote flow reads.
    const sessionContext = `Workspace rules:\n- Your working directory is: ${agentCwd}\n- Do ALL file reads and edits inside this working directory, using relative paths (or paths under it). Never write to any other absolute path.\n- This is an isolated workspace; your changes are reviewed and promoted to the real repo separately. Do not try to locate or modify the "real" repo yourself.\n- baseline: ${existing.meta.baselineSha || "unknown"}`;
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
        // Push a boundary update as soon as a file-mutating tool lands so the
        // right rail tracks changes live, not on a poll timer.
        if (event.type === "tool_call" && MUTATING_TOOLS.has(event.tool)) {
          scheduleBoundaryRecompute(id, projectPath);
        }
        if (event.type === "turn_end") {
          const patch: Record<string, unknown> = {
            status: event.reason === "error" ? "error" : event.reason === "aborted" ? "aborted" : "done"
          };
          if (event.cost != null && event.tokens) {
            const doc = await getSession(projectPath, id);
            const prev = doc?.meta;
            if (prev) {
              const addTokens = (a: TokenUsage, b: TokenUsage): TokenUsage => ({
                input: a.input + b.input,
                output: a.output + b.output,
                reasoning: a.reasoning + b.reasoning,
                cacheRead: a.cacheRead + b.cacheRead,
                cacheWrite: a.cacheWrite + b.cacheWrite
              });
              patch.totalCost = (prev.totalCost ?? 0) + (event.cost ?? 0);
              patch.totalTokens = addTokens(prev.totalTokens ?? { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 }, event.tokens);
            }
          }
          await patchSessionMeta(projectPath, id, patch as any);
          // Guaranteed final boundary flush after the turn settles.
          void flushBoundaryRecompute(id, projectPath);
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
    const abortedEvt: AgentEvent = { type: "aborted", turnId, at: new Date().toISOString() };
    const turnEndEvt: AgentEvent = { type: "turn_end", turnId, reason: "aborted", at: new Date().toISOString() };
    await appendEvents(projectPath, id, [abortedEvt, turnEndEvt]);
    // Broadcast so SSE clients immediately exit the stopping state; runTurn's
    // own turn_end may never fire if pi resolves cleanly after abort.
    broadcast(id, abortedEvt);
    broadcast(id, turnEndEvt);
    await patchSessionMeta(projectPath, id, { status: "aborted" });
    // Reflect any partial changes the aborted turn made.
    void flushBoundaryRecompute(id, projectPath);
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
