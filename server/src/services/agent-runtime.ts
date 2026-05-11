import type { AgentEvent } from "@glib-code/shared/events/agent";
import { createAgentSession, SessionManager } from "@mariozechner/pi-coding-agent";
import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";
import { getPiCore, validateProviderAuth } from "./pi-core";
import { attachPiRpc } from "./pi-rpc";
import type { PiEvent, PiRpcClient } from "./pi-rpc";
import { createSandboxFactory } from "./sandbox";
import type { Sandbox, SandboxProcess, SandboxFactory } from "./sandbox";
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

type SandboxSession = {
  sandbox: Sandbox;
  process: SandboxProcess;
  pi: PiRpcClient;
  cwd: string;
};

const subscribers = new Map<string, Set<Subscriber>>();
const runningTurns = new Map<string, RunningTurn>();
const runtimeSessions = new Map<string, RuntimeSession>();
const sandboxSessions = new Map<string, SandboxSession>();
const assistantMessageSeqByTurn = new Map<string, number>();
const currentAssistantMessageKeyByTurn = new Map<string, string>();
const streamedTextByMessage = new Map<string, string>();
const turnHasAssistantText = new Set<string>();
const errorEmittedByTurn = new Set<string>();
const toolCallsById = new Map<string, { input: object; tool: string; title: string }>();
const toolCallIdBySignature = new Map<string, string>();
const normalizedToolCallIdByRaw = new Map<string, string>();
const pendingToolCallIdsByTurnTool = new Map<string, string[]>();
let textPartSeq = 0;
let sandboxFactory: SandboxFactory | null = null;

const PI_RPC_CMD = process.env.GLIB_PI_RPC_CMD || "pi";
const PI_RPC_ARGS = process.env.GLIB_PI_RPC_ARGS?.split(" ").filter(Boolean) ?? ["--mode", "rpc", "--no-session"];

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

export async function disposeRuntimeSession(sessionId: string) {
  const sdk = runtimeSessions.get(sessionId);
  if (sdk) runtimeSessions.delete(sessionId);
  const sandboxed = sandboxSessions.get(sessionId);
  if (!sandboxed) return;
  sandboxSessions.delete(sessionId);
  await sandboxed.pi.dispose().catch((error) => logError("agent", "failed to dispose pi rpc", error, { sessionId }));
  await sandboxed.sandbox.destroy().catch((error) => logError("agent", "failed to destroy sandbox", error, { sessionId }));
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

function currentMessageKey(turnId: string) {
  let key = currentAssistantMessageKeyByTurn.get(turnId);
  if (key) return key;
  const seq = (assistantMessageSeqByTurn.get(turnId) ?? 0) + 1;
  assistantMessageSeqByTurn.set(turnId, seq);
  key = `${turnId}:${seq}`;
  currentAssistantMessageKeyByTurn.set(turnId, key);
  return key;
}

function startAssistantMessage(turnId: string) {
  const seq = (assistantMessageSeqByTurn.get(turnId) ?? 0) + 1;
  assistantMessageSeqByTurn.set(turnId, seq);
  const key = `${turnId}:${seq}`;
  currentAssistantMessageKeyByTurn.set(turnId, key);
  return key;
}

function rememberText(turnId: string, text: string, messageKey = currentMessageKey(turnId), storeText = true) {
  if (storeText) streamedTextByMessage.set(messageKey, `${streamedTextByMessage.get(messageKey) ?? ""}${text}`);
  if (text.trim()) turnHasAssistantText.add(turnId);
  return {
    type: "text_part" as const,
    turnId,
    stepId: `step_${turnId}`,
    partId: `part_${turnId}_${++textPartSeq}`,
    text,
    at: nowIso()
  };
}

function suffixFromFinal(streamed: string, finalText: string) {
  if (!finalText) return "";
  if (!streamed) return finalText;
  if (finalText.startsWith(streamed)) return finalText.slice(streamed.length);
  let i = 0;
  const max = Math.min(streamed.length, finalText.length);
  while (i < max && streamed[i] === finalText[i]) i += 1;
  return finalText.slice(i);
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

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}

function hashString(value: string) {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  return (hash >>> 0).toString(36);
}

function toolNameFromEvent(event: AgentSessionEvent | PiEvent) {
  return String((event as any).toolName ?? (event as any).name ?? (event as any).tool ?? "tool");
}

function rawToolCallId(event: AgentSessionEvent | PiEvent) {
  const raw = (event as any).toolCallId ?? (event as any).toolExecutionId ?? (event as any).callId ?? (event as any).id;
  return typeof raw === "string" && raw.trim() ? raw.trim() : "";
}

function pendingToolKey(turnId: string, tool: string) {
  return `${turnId}:${tool}`;
}

function toolSignature(turnId: string, tool: string, input: object) {
  return `${turnId}:${tool}:${hashString(stableJson(input))}`;
}

function toolInputFromEvent(event: AgentSessionEvent | PiEvent) {
  return (((event as any).args ?? (event as any).input ?? {}) || {}) as object;
}

function startToolCall(turnId: string, event: AgentSessionEvent | PiEvent) {
  const tool = toolNameFromEvent(event);
  const input = toolInputFromEvent(event);
  const rawId = rawToolCallId(event);
  const signature = toolSignature(turnId, tool, input);
  const callId = toolCallIdBySignature.get(signature) || (rawId ? `tool_${rawId}` : `tool_${turnId}_${tool}_${hashString(stableJson(input))}`);
  toolCallIdBySignature.set(signature, callId);
  if (rawId) normalizedToolCallIdByRaw.set(`${turnId}:${rawId}`, callId);

  const key = `${turnId}:${callId}`;
  toolCallsById.set(key, { input, tool, title: tool });

  const pendingKey = pendingToolKey(turnId, tool);
  const pending = pendingToolCallIdsByTurnTool.get(pendingKey) ?? [];
  if (!pending.includes(callId)) pending.push(callId);
  pendingToolCallIdsByTurnTool.set(pendingKey, pending);

  return { callId, tool, title: tool, input };
}

function endToolCall(turnId: string, event: AgentSessionEvent | PiEvent) {
  const tool = toolNameFromEvent(event);
  const rawId = rawToolCallId(event);
  let callId = rawId ? (normalizedToolCallIdByRaw.get(`${turnId}:${rawId}`) ?? `tool_${rawId}`) : "";
  if (!callId) {
    const pendingKey = pendingToolKey(turnId, tool);
    const pending = pendingToolCallIdsByTurnTool.get(pendingKey) ?? [];
    callId = pending.shift() ?? "";
    if (pending.length) pendingToolCallIdsByTurnTool.set(pendingKey, pending);
    else pendingToolCallIdsByTurnTool.delete(pendingKey);
  }

  callId ||= `tool_${turnId}_${tool}_${hashString(stableJson((event as any).result ?? {}))}`;
  const key = `${turnId}:${callId}`;
  const started = toolCallsById.get(key);
  toolCallsById.delete(key);

  return {
    callId,
    tool: started?.tool ?? tool,
    title: started?.title ?? tool,
    input: started?.input ?? toolInputFromEvent(event)
  };
}

function cleanupTurnState(turnId: string) {
  assistantMessageSeqByTurn.delete(turnId);
  currentAssistantMessageKeyByTurn.delete(turnId);
  turnHasAssistantText.delete(turnId);
  errorEmittedByTurn.delete(turnId);
  for (const key of [...streamedTextByMessage.keys()]) {
    if (key.startsWith(`${turnId}:`)) streamedTextByMessage.delete(key);
  }
  for (const key of [...toolCallsById.keys()]) {
    if (key.startsWith(`${turnId}:`)) toolCallsById.delete(key);
  }
  for (const key of [...toolCallIdBySignature.keys()]) {
    if (key.startsWith(`${turnId}:`)) toolCallIdBySignature.delete(key);
  }
  for (const key of [...normalizedToolCallIdByRaw.keys()]) {
    if (key.startsWith(`${turnId}:`)) normalizedToolCallIdByRaw.delete(key);
  }
  for (const key of [...pendingToolCallIdsByTurnTool.keys()]) {
    if (key.startsWith(`${turnId}:`)) pendingToolCallIdsByTurnTool.delete(key);
  }
}

function mapPiEvent(turnId: string, event: AgentSessionEvent | PiEvent): AgentEvent | null {
  if (event.type === "process_exit") {
    return {
      type: "error",
      turnId,
      name: "pi_crashed",
      message: `pi exited with code ${String((event as any).code ?? "unknown")}`,
      retryable: false,
      at: nowIso()
    };
  }
  if (event.type === "aborted") {
    return { type: "aborted", turnId, at: nowIso() };
  }
  if (event.type === "turn_end") {
    const errorMessage = extractMessageError((event as any).message);
    if (errorMessage) return rememberError(turnId, errorMessage);
    return null;
  }
  if (event.type === "message_start") {
    const message = (event as any).message;
    if (!isAssistantMessage(message)) return null;
    const key = startAssistantMessage(turnId);
    return turnHasAssistantText.has(turnId) ? rememberText(turnId, "\n\n", key, false) : null;
  }
  if (event.type === "message_end") {
    const errorMessage = extractMessageError((event as any).message);
    if (errorMessage) return rememberError(turnId, errorMessage);
    const finalText = extractMessageText((event as any).message);
    const key = currentMessageKey(turnId);
    const streamed = streamedTextByMessage.get(key) ?? "";
    const delta = suffixFromFinal(streamed, finalText);
    return delta ? rememberText(turnId, delta, key) : null;
  }
  if (event.type === "message_update") {
    const assistantEvent = (event as any).assistantMessageEvent;
    const text = assistantEvent?.type === "text_delta" ? assistantEvent.delta : "";
    if (!text) return null;
    return rememberText(turnId, String(text));
  }
  if (event.type === "tool_execution_start") {
    const toolCall = startToolCall(turnId, event);
    return {
      type: "tool_call",
      turnId,
      stepId: `step_${turnId}`,
      callId: toolCall.callId,
      tool: toolCall.tool,
      title: toolCall.title,
      input: toolCall.input,
      output: "",
      metadata: {},
      durationMs: 0,
      at: nowIso()
    };
  }
  if (event.type === "tool_execution_end") {
    const toolCall = endToolCall(turnId, event);
    return {
      type: "tool_call",
      turnId,
      stepId: `step_${turnId}`,
      callId: toolCall.callId,
      tool: toolCall.tool,
      title: toolCall.title,
      input: toolCall.input,
      output: JSON.stringify(event.result ?? {}),
      metadata: { isError: event.isError },
      durationMs: 0,
      at: nowIso()
    };
  }
  return null;
}

function logMappedAgentEvent(sessionId: string, event: AgentEvent) {
  if (event.type === "tool_call") {
    log("agent", "tool call", {
      sessionId,
      turnId: event.turnId,
      callId: event.callId,
      tool: event.tool,
      inputKeys: Object.keys(event.input ?? {}),
      outputLength: event.output.length,
      isError: (event.metadata as { isError?: unknown }).isError === true
    });
    return;
  }

  if (event.type === "error") {
    log("agent", "agent error event", { sessionId, turnId: event.turnId, name: event.name, message: event.message });
    return;
  }

  if (event.type === "aborted") {
    log("agent", "turn aborted", { sessionId, turnId: event.turnId });
  }
}

function useRpcRuntime() {
  return process.env.GLIB_PI_RUNTIME !== "sdk";
}

function providerEnvName(provider: string) {
  const normalized = provider.toLowerCase().replace(/[^a-z0-9]/g, "_").toUpperCase();
  const known: Record<string, string> = {
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
    google: "GOOGLE_API_KEY",
    gemini: "GOOGLE_API_KEY",
    groq: "GROQ_API_KEY",
    openrouter: "OPENROUTER_API_KEY"
  };
  return known[provider.toLowerCase()] ?? `${normalized}_API_KEY`;
}

async function getOrCreateSandboxSession(sessionId: string, cwd: string, provider?: string, modelId?: string) {
  const existing = sandboxSessions.get(sessionId);
  if (existing && existing.cwd === cwd) {
    const exitCode = await Promise.race([existing.process.exitCode, new Promise<null>((resolve) => setTimeout(() => resolve(null), 0))]);
    if (exitCode === null) return existing;

    log("agent", "pi rpc exited; respawning in existing sandbox", { sessionId, exitCode });
    await existing.pi.dispose().catch((error) => logError("agent", "failed to dispose exited pi rpc", error, { sessionId }));
    const { processHandle, pi } = await spawnPiRpc(existing.sandbox, sessionId, provider, modelId);
    const next: SandboxSession = { ...existing, process: processHandle, pi };
    sandboxSessions.set(sessionId, next);
    return next;
  }
  if (existing) await disposeRuntimeSession(sessionId);

  const { modelRegistry, authStorage } = await getPiCore();
  const model = provider && modelId ? modelRegistry.find(provider, modelId) : undefined;
  if (provider && modelId && !model) throw new Error(`Model not found: ${provider}/${modelId}`);
  if (model) await validateProviderAuth(model.provider);

  sandboxFactory ??= createSandboxFactory();
  const sandbox = await sandboxFactory.create({ sessionId, cwd });
  try {
    const { processHandle, pi } = await spawnPiRpc(sandbox, sessionId, provider, modelId);
    const next: SandboxSession = { sandbox, process: processHandle, pi, cwd };
    sandboxSessions.set(sessionId, next);
    return next;
  } catch (error) {
    await sandbox.destroy().catch(() => {});
    throw error;
  }
}

async function spawnPiRpc(sandbox: Sandbox, sessionId: string, provider?: string, modelId?: string) {
  const { authStorage } = await getPiCore();
  const env: Record<string, string> = {};
  if (provider) {
    const key = await authStorage.getApiKey(provider, { includeFallback: true });
    if (key) env[providerEnvName(provider)] = key;
  }
  const args = [...PI_RPC_ARGS];
  if (provider) args.push("--provider", provider);
  if (modelId) args.push("--model", modelId);

  let processHandle: SandboxProcess;
  try {
    processHandle = await sandbox.spawn({ cmd: PI_RPC_CMD, args, cwd: sandbox.cwd, env });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = /ENOENT|not found/i.test(message) ? "SANDBOX_PI_MISSING" : "SANDBOX_START_FAILED";
    throw new Error(`${code}: ${message}`);
  }

  const pi = attachPiRpc(processHandle, {
    onError: (error) => logError("agent", "pi rpc error", error, { sessionId })
  });
  const immediateExit = await Promise.race([processHandle.exitCode, new Promise<null>((resolve) => setTimeout(() => resolve(null), 100))]);
  if (typeof immediateExit === "number") {
    const stderr = pi.getStderr();
    await pi.dispose().catch(() => {});
    const code = /ENOENT|not found|not recognized/i.test(stderr) ? "SANDBOX_PI_MISSING" : "SANDBOX_START_FAILED";
    throw new Error(`${code}: pi exited with code ${immediateExit}${stderr ? `: ${stderr}` : ""}`);
  }

  return { processHandle, pi };
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
    const runtime = useRpcRuntime()
      ? await getOrCreateSandboxSession(params.sessionId, params.cwd, params.provider, params.model)
      : await getOrCreateRuntimeSession(params.sessionId, params.cwd, params.provider, params.model);
    const startEvent: AgentEvent = { type: "turn_start", turnId: params.turnId, at: nowIso() };
    await params.onEvent(startEvent);
    broadcast(params.sessionId, startEvent);

    const subscribeToRuntime = "pi" in runtime ? runtime.pi.subscribe.bind(runtime.pi) : runtime.session.subscribe.bind(runtime.session);
    const promptRuntime = "pi" in runtime ? runtime.pi.prompt.bind(runtime.pi) : runtime.session.prompt.bind(runtime.session);
    const abortRuntime = "pi" in runtime ? runtime.pi.abort.bind(runtime.pi) : runtime.session.abort.bind(runtime.session);

    unsub = subscribeToRuntime(async (evt: AgentSessionEvent | PiEvent) => {
      const mapped = mapPiEvent(params.turnId, evt);
      if (!mapped) return;
      logMappedAgentEvent(params.sessionId, mapped);
      await params.onEvent(mapped);
      broadcast(params.sessionId, mapped);
    });

    runningTurns.set(params.sessionId, {
      turnId: params.turnId,
      startedAt: nowIso(),
      abort: () => abortRuntime()
    });

    if ("pi" in runtime) {
      await promptRuntime(params.prompt);
    } else {
      await promptRuntime(params.prompt, {
        preflightResult: (success: boolean) => {
          log("agent", "pi preflight", { sessionId: params.sessionId, turnId: params.turnId, success });
        }
      });
    }
    if (runningTurns.get(params.sessionId)?.turnId !== params.turnId) return { turnId: params.turnId, ok: true };
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
    cleanupTurnState(params.turnId);
  }
}
