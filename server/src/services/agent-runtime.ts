import type { AgentEvent } from "@glib-code/shared/events/agent";
import { createAgentSession, SessionManager } from "@mariozechner/pi-coding-agent";
import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";
import { getPiCore, validateProviderAuth } from "./pi-core";
import { log, logError } from "../lib/log";

type Subscriber = (event: AgentEvent) => void;

type RunningTurn = {
  turnId: string;
  startedAt: string;
  abort: () => Promise<void>;
};

type RuntimeSession = {
  cwd: string;
  session: Awaited<ReturnType<typeof createAgentSession>>["session"];
};

const subscribers = new Map<string, Set<Subscriber>>();
const runningTurns = new Map<string, RunningTurn>();
const runtimeSessions = new Map<string, RuntimeSession>();
const streamedTextLengthByTurn = new Map<string, number>();
const errorEmittedByTurn = new Set<string>();

function nowIso() {
  return new Date().toISOString();
}

export function subscribe(sessionId: string, fn: Subscriber) {
  const set = subscribers.get(sessionId) ?? new Set<Subscriber>();
  set.add(fn);
  subscribers.set(sessionId, set);
  return () => {
    const s = subscribers.get(sessionId);
    if (!s) return;
    s.delete(fn);
    if (!s.size) subscribers.delete(sessionId);
  };
}

export function broadcast(sessionId: string, event: AgentEvent) {
  const set = subscribers.get(sessionId);
  if (!set) return;
  for (const cb of set) cb(event);
}

export function getRunningTurn(sessionId: string) {
  return runningTurns.get(sessionId) ?? null;
}

export function abortRunningTurn(sessionId: string) {
  const running = runningTurns.get(sessionId);
  if (!running) return null;
  void running.abort();
  runningTurns.delete(sessionId);
  return running.turnId;
}

function isAssistantMessage(message: unknown) {
  const msg = message as { role?: unknown } | undefined;
  return msg?.role === "assistant";
}

function extractMessageText(message: unknown) {
  const msg = message as { content?: unknown; role?: unknown } | undefined;
  if (!isAssistantMessage(msg)) return "";
  if (typeof msg?.content === "string") return msg.content;
  if (!Array.isArray(msg?.content)) return "";
  return msg.content
    .map((part) => {
      const p = part as { type?: string; text?: unknown };
      return p?.type === "text" && typeof p.text === "string" ? p.text : "";
    })
    .join("");
}

function extractMessageError(message: unknown) {
  const msg = message as { errorMessage?: unknown; role?: unknown } | undefined;
  if (!isAssistantMessage(msg)) return "";
  return typeof msg?.errorMessage === "string" ? msg.errorMessage : "";
}

function rememberText(turnId: string, text: string) {
  streamedTextLengthByTurn.set(turnId, (streamedTextLengthByTurn.get(turnId) ?? 0) + text.length);
  return {
    type: "text_part" as const,
    turnId,
    stepId: `step_${turnId}`,
    partId: `part_${Date.now().toString(36)}`,
    text,
    at: nowIso()
  };
}

function rememberError(turnId: string, message: string): AgentEvent | null {
  if (errorEmittedByTurn.has(turnId)) return null;
  errorEmittedByTurn.add(turnId);
  return {
    type: "error",
    turnId,
    name: "pi_error",
    message,
    retryable: false,
    at: nowIso()
  };
}

function mapPiEvent(turnId: string, event: AgentSessionEvent): AgentEvent | null {
  if (event.type === "turn_end") {
    const errorMessage = extractMessageError((event as any).message);
    if (errorMessage) return rememberError(turnId, errorMessage);
    const finalText = extractMessageText((event as any).message);
    const seenLength = streamedTextLengthByTurn.get(turnId) ?? 0;
    const delta = finalText.slice(seenLength);
    return delta ? rememberText(turnId, delta) : null;
  }
  if (event.type === "message_end") {
    const errorMessage = extractMessageError((event as any).message);
    if (errorMessage) return rememberError(turnId, errorMessage);
    const finalText = extractMessageText((event as any).message);
    const seenLength = streamedTextLengthByTurn.get(turnId) ?? 0;
    const delta = finalText.slice(seenLength);
    return delta ? rememberText(turnId, delta) : null;
  }
  if (event.type === "message_update") {
    const assistantEvent = (event as any).assistantMessageEvent;
    const text = assistantEvent?.type === "text_delta" ? assistantEvent.delta : "";
    if (!text) return null;
    return rememberText(turnId, String(text));
  }
  if (event.type === "tool_execution_start") {
    return {
      type: "tool_call",
      turnId,
      stepId: `step_${turnId}`,
      callId: event.toolCallId,
      tool: event.toolName,
      title: event.toolName,
      input: (event.args ?? {}) as object,
      output: "",
      metadata: {},
      durationMs: 0,
      at: nowIso()
    };
  }
  if (event.type === "tool_execution_end") {
    return {
      type: "tool_call",
      turnId,
      stepId: `step_${turnId}`,
      callId: event.toolCallId,
      tool: event.toolName,
      title: event.toolName,
      input: {},
      output: JSON.stringify(event.result ?? {}),
      metadata: { isError: event.isError },
      durationMs: 0,
      at: nowIso()
    };
  }
  return null;
}

async function getOrCreateRuntimeSession(sessionId: string, cwd: string, provider?: string, modelId?: string) {
  const existing = runtimeSessions.get(sessionId);
  if (existing && existing.cwd === cwd) return existing;

  const { modelRegistry, authStorage } = await getPiCore();
  const model = provider && modelId ? modelRegistry.find(provider, modelId) : undefined;
  if (provider && modelId && !model) throw new Error(`Model not found: ${provider}/${modelId}`);
  if (model) await validateProviderAuth(model.provider);

  const created = await createAgentSession({
    cwd,
    authStorage,
    modelRegistry,
    model,
    tools: ["read", "bash", "edit", "write"],
    sessionManager: SessionManager.inMemory()
  });

  const next: RuntimeSession = { cwd, session: created.session };
  runtimeSessions.set(sessionId, next);
  return next;
}

export async function runTurn(params: {
  sessionId: string;
  turnId: string;
  cwd: string;
  prompt: string;
  model?: string;
  provider?: string;
  onEvent: (event: AgentEvent) => Promise<void> | void;
}) {
  let unsub = () => {};
  log("agent", "turn starting", { sessionId: params.sessionId, turnId: params.turnId, provider: params.provider, model: params.model, cwd: params.cwd });

  try {
    const runtime = await getOrCreateRuntimeSession(params.sessionId, params.cwd, params.provider, params.model);
    const startEvent: AgentEvent = { type: "turn_start", turnId: params.turnId, at: nowIso() };
    await params.onEvent(startEvent);
    broadcast(params.sessionId, startEvent);

    unsub = runtime.session.subscribe(async (evt) => {
      const message = (evt as any).message;
      const assistantMessageEvent = (evt as any).assistantMessageEvent;
      log("agent", "pi event", {
        sessionId: params.sessionId,
        turnId: params.turnId,
        type: evt.type,
        role: message?.role,
        contentLength: extractMessageText(message).length,
        assistantEvent: assistantMessageEvent?.type
      });
      const mapped = mapPiEvent(params.turnId, evt);
      if (!mapped) return;
      await params.onEvent(mapped);
      broadcast(params.sessionId, mapped);
    });

    runningTurns.set(params.sessionId, {
      turnId: params.turnId,
      startedAt: nowIso(),
      abort: () => runtime.session.abort()
    });

    await runtime.session.prompt(params.prompt, {
      preflightResult: (success) => {
        log("agent", "pi preflight", { sessionId: params.sessionId, turnId: params.turnId, success });
      }
    });
    const end: AgentEvent = { type: "turn_end", turnId: params.turnId, reason: "stop", at: nowIso() };
    await params.onEvent(end);
    broadcast(params.sessionId, end);
    log("agent", "turn stopped", { sessionId: params.sessionId, turnId: params.turnId });
    return { turnId: params.turnId, ok: true };
  } catch (error) {
    logError("agent", "turn failed", error, { sessionId: params.sessionId, turnId: params.turnId });
    const evt: AgentEvent = {
      type: "error",
      turnId: params.turnId,
      name: "pi_error",
      message: error instanceof Error ? error.message : "failed to run pi",
      retryable: false,
      at: nowIso()
    };
    await params.onEvent(evt);
    broadcast(params.sessionId, evt);
    const end: AgentEvent = { type: "turn_end", turnId: params.turnId, reason: "error", at: nowIso() };
    await params.onEvent(end);
    broadcast(params.sessionId, end);
    return { turnId: params.turnId, ok: false };
  } finally {
    unsub();
    runningTurns.delete(params.sessionId);
    streamedTextLengthByTurn.delete(params.turnId);
    errorEmittedByTurn.delete(params.turnId);
  }
}
