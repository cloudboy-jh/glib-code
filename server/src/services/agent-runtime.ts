import type { AgentEvent } from "@glib-code/shared/events/agent";
import type { OpencodeEvent } from "@glib-code/shared/events/opencode";

type Subscriber = (event: AgentEvent) => void;

type RunningTurn = {
  turnId: string;
  startedAt: string;
  proc: Bun.Subprocess;
};

const subscribers = new Map<string, Set<Subscriber>>();
const runningTurns = new Map<string, RunningTurn>();

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
  running.proc.kill();
  runningTurns.delete(sessionId);
  return running.turnId;
}

function eventFromOpencode(turnId: string, input: OpencodeEvent): AgentEvent | null {
  if (input.type === "step_start") {
    return {
      type: "step_start",
      turnId,
      stepId: input.part.id,
      snapshot: input.part.snapshot,
      at: new Date(input.timestamp).toISOString()
    };
  }
  if (input.type === "text") {
    return {
      type: "text_part",
      turnId,
      stepId: input.part.messageID,
      partId: input.part.id,
      text: input.part.text,
      at: new Date(input.timestamp).toISOString()
    };
  }
  if (input.type === "tool_use") {
    return {
      type: "tool_call",
      turnId,
      stepId: input.part.messageID,
      callId: input.part.callID,
      tool: input.part.tool,
      title: input.part.state.title,
      input: input.part.state.input,
      output: input.part.state.output,
      metadata: input.part.state.metadata,
      durationMs: input.part.state.time.end - input.part.state.time.start,
      at: new Date(input.timestamp).toISOString()
    };
  }
  if (input.type === "step_finish") {
    return {
      type: "step_end",
      turnId,
      stepId: input.part.id,
      reason: input.part.reason,
      cost: input.part.cost,
      tokens: {
        input: input.part.tokens.input,
        output: input.part.tokens.output,
        reasoning: input.part.tokens.reasoning,
        cacheRead: input.part.tokens.cache.read,
        cacheWrite: input.part.tokens.cache.write
      },
      at: new Date(input.timestamp).toISOString()
    };
  }
  if (input.type === "error") {
    return {
      type: "error",
      turnId,
      name: input.error.name,
      message: input.error.data?.message,
      retryable: input.error.data?.isRetryable,
      at: new Date(input.timestamp).toISOString()
    };
  }
  return null;
}

export async function runTurn(params: {
  sessionId: string;
  cwd: string;
  prompt: string;
  model?: string;
  onEvent: (event: AgentEvent) => Promise<void> | void;
}) {
  const turnId = `turn_${Date.now().toString(36)}`;
  const startEvent: AgentEvent = { type: "turn_start", turnId, at: nowIso() };
  await params.onEvent(startEvent);
  broadcast(params.sessionId, startEvent);

  const base = process.env.GLIB_OPENCODE_CMD?.trim() || "opencode run --format json";
  const cmd = base.split(/\s+/g).filter(Boolean);
  const args = [...cmd.slice(1), params.prompt];
  if (params.model) args.unshift("--model", params.model);

  const proc = Bun.spawn({
    cmd: [cmd[0], ...args],
    cwd: params.cwd,
    stdout: "pipe",
    stderr: "pipe"
  });

  runningTurns.set(params.sessionId, { turnId, startedAt: nowIso(), proc });

  try {
    const raw = await new Response(proc.stdout).text();
    const lines = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      let parsed: OpencodeEvent | null = null;
      try {
        parsed = JSON.parse(line) as OpencodeEvent;
      } catch {
        continue;
      }
      const evt = eventFromOpencode(turnId, parsed);
      if (!evt) continue;
      await params.onEvent(evt);
      broadcast(params.sessionId, evt);
    }

    const exitCode = await proc.exited;
    const end: AgentEvent = {
      type: "turn_end",
      turnId,
      reason: exitCode === 0 ? "stop" : "error",
      at: nowIso()
    };
    await params.onEvent(end);
    broadcast(params.sessionId, end);
    return { turnId, ok: exitCode === 0 };
  } catch (error) {
    const evt: AgentEvent = {
      type: "error",
      turnId,
      name: "spawn_error",
      message: error instanceof Error ? error.message : "failed to run opencode",
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
    runningTurns.delete(params.sessionId);
  }
}
