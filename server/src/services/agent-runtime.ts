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
const streamedTextByTurn = new Map<string, string>();
const errorEmittedByTurn = new Set<string>();
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

function rememberText(turnId: string, text: string) {
  streamedTextByTurn.set(turnId, `${streamedTextByTurn.get(turnId) ?? ""}${text}`);
  return {
    type: "text_part" as const,
    turnId,
    stepId: `step_${turnId}`,
    partId: `part_${Date.now().toString(36)}`,
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
    const finalText = extractMessageText((event as any).message);
    const streamed = streamedTextByTurn.get(turnId) ?? "";
    const delta = suffixFromFinal(streamed, finalText);
    return delta ? rememberText(turnId, delta) : null;
  }
  if (event.type === "message_end") {
    const errorMessage = extractMessageError((event as any).message);
    if (errorMessage) return rememberError(turnId, errorMessage);
    const finalText = extractMessageText((event as any).message);
    const streamed = streamedTextByTurn.get(turnId) ?? "";
    const delta = suffixFromFinal(streamed, finalText);
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
      callId: String((event as any).toolCallId ?? ""),
      tool: String((event as any).toolName ?? "tool"),
      title: String((event as any).toolName ?? "tool"),
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
      callId: String((event as any).toolCallId ?? ""),
      tool: String((event as any).toolName ?? "tool"),
      title: String((event as any).toolName ?? "tool"),
      input: {},
      output: JSON.stringify(event.result ?? {}),
      metadata: { isError: event.isError },
      durationMs: 0,
      at: nowIso()
    };
  }
  return null;
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
  if (existing && existing.cwd === cwd) return existing;
  if (existing) await disposeRuntimeSession(sessionId);

  const { modelRegistry, authStorage } = await getPiCore();
  const model = provider && modelId ? modelRegistry.find(provider, modelId) : undefined;
  if (provider && modelId && !model) throw new Error(`Model not found: ${provider}/${modelId}`);
  if (model) await validateProviderAuth(model.provider);

  sandboxFactory ??= createSandboxFactory();
  const sandbox = await sandboxFactory.create({ sessionId, cwd });
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
    await sandbox.destroy().catch(() => {});
    const message = error instanceof Error ? error.message : String(error);
    const code = /ENOENT|not found/i.test(message) ? "SANDBOX_PI_MISSING" : "SANDBOX_START_FAILED";
    throw new Error(`${code}: ${message}`);
  }

  const pi = attachPiRpc(processHandle, {
    onError: (error) => logError("agent", "pi rpc error", error, { sessionId })
  });
  const immediateExit = await Promise.race([processHandle.exitCode, new Promise<null>((resolve) => setTimeout(() => resolve(null), 100))]);
  if (typeof immediateExit === "number") {
    await sandbox.destroy().catch(() => {});
    const stderr = pi.getStderr();
    const code = /ENOENT|not found|not recognized/i.test(stderr) ? "SANDBOX_PI_MISSING" : "SANDBOX_START_FAILED";
    throw new Error(`${code}: pi exited with code ${immediateExit}${stderr ? `: ${stderr}` : ""}`);
  }
  const next: SandboxSession = { sandbox, process: processHandle, pi, cwd };
  sandboxSessions.set(sessionId, next);
  return next;
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
    streamedTextByTurn.delete(params.turnId);
    errorEmittedByTurn.delete(params.turnId);
  }
}
