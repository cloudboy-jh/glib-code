import type { AgentEvent } from "@glib-code/shared/events/agent";
import { createAgentSession } from "@mariozechner/pi-coding-agent";
import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";
import { getPiCore } from "./pi-core";

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

function mapPiEvent(turnId: string, event: AgentSessionEvent): AgentEvent | null {
  if (event.type === "turn_start") return { type: "turn_start", turnId, at: nowIso() };
  if (event.type === "turn_end") return { type: "turn_end", turnId, reason: "stop", at: nowIso() };
  if (event.type === "message_update") {
    const assistant = event.message as any;
    const parts = Array.isArray(assistant?.content) ? assistant.content : [];
    const lastText = [...parts].reverse().find((p: any) => p?.type === "text");
    if (!lastText?.text) return null;
    return {
      type: "text_part",
      turnId,
      stepId: `step_${turnId}`,
      partId: `part_${Date.now().toString(36)}`,
      text: String(lastText.text),
      at: nowIso()
    };
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

  const created = await createAgentSession({
    cwd,
    authStorage,
    modelRegistry,
    model,
    tools: ["read", "bash", "edit", "write"]
  });

  const next: RuntimeSession = { cwd, session: created.session };
  runtimeSessions.set(sessionId, next);
  return next;
}

export async function runTurn(params: {
  sessionId: string;
  cwd: string;
  prompt: string;
  model?: string;
  provider?: string;
  onEvent: (event: AgentEvent) => Promise<void> | void;
}) {
  const turnId = `turn_${Date.now().toString(36)}`;
  const runtime = await getOrCreateRuntimeSession(params.sessionId, params.cwd, params.provider, params.model);
  const startEvent: AgentEvent = { type: "turn_start", turnId, at: nowIso() };
  await params.onEvent(startEvent);
  broadcast(params.sessionId, startEvent);

  const unsub = runtime.session.subscribe(async (evt) => {
    const mapped = mapPiEvent(turnId, evt);
    if (!mapped) return;
    await params.onEvent(mapped);
    broadcast(params.sessionId, mapped);
  });

  runningTurns.set(params.sessionId, {
    turnId,
    startedAt: nowIso(),
    abort: () => runtime.session.abort()
  });

  try {
    await runtime.session.prompt(params.prompt);
    const end: AgentEvent = { type: "turn_end", turnId, reason: "stop", at: nowIso() };
    await params.onEvent(end);
    broadcast(params.sessionId, end);
    return { turnId, ok: true };
  } catch (error) {
    const evt: AgentEvent = {
      type: "error",
      turnId,
      name: "pi_error",
      message: error instanceof Error ? error.message : "failed to run pi",
      retryable: false,
      at: nowIso()
    };
    await params.onEvent(evt);
    broadcast(params.sessionId, evt);
    const end: AgentEvent = { type: "turn_end", turnId, reason: "error", at: nowIso() };
    await params.onEvent(end);
    broadcast(params.sessionId, end);
    return { turnId, ok: false };
  } finally {
    unsub();
    runningTurns.delete(params.sessionId);
  }
}
