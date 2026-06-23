import { Hono } from "hono";
import { upgradeWebSocket } from "hono/bun";
import { fallbackProjectPath } from "../services/project-store";

type TermInbound =
  | { type: "hello"; sessionId?: string }
  | { type: "run"; id: string; command: string; cwd?: string }
  | { type: "cancel"; id: string }
  | { type: "ping" };

type TermOutbound =
  | { type: "ready"; capabilities: { run: boolean; interactive: false; cancel: true; shell: string; platform: NodeJS.Platform } }
  | { type: "ack"; sessionId: string }
  | { type: "output"; id: string; stream: "stdout" | "stderr"; text: string }
  | { type: "exit"; id: string; code: number }
  | { type: "error"; code: string; message: string; retryable?: boolean }
  | { type: "pong" };

function asJson(message: unknown): TermInbound | null {
  try {
    const text = typeof message === "string"
      ? message
      : message instanceof ArrayBuffer
        ? new TextDecoder().decode(message)
        : ArrayBuffer.isView(message)
          ? new TextDecoder().decode(message)
          : null;
    if (!text) return null;
    return JSON.parse(text) as TermInbound;
  } catch {
    return null;
  }
}

type TermSocket = { send: (data: string) => void };

type ShellConfig = {
  shell: string;
  args: string[];
};

function resolveShellConfig(): ShellConfig {
  const fromEnv = process.env.GLIB_TERMINAL_SHELL?.trim();
  if (fromEnv) {
    if (process.platform === "win32") return { shell: fromEnv, args: ["-NoProfile", "-Command"] };
    return { shell: fromEnv, args: ["-lc"] };
  }

  if (process.platform === "win32") return { shell: "pwsh", args: ["-NoProfile", "-Command"] };

  if (Bun.which("zsh")) return { shell: "zsh", args: ["-lc"] };
  if (Bun.which("bash")) return { shell: "bash", args: ["-lc"] };
  return { shell: "sh", args: ["-lc"] };
}

const shellConfig = resolveShellConfig();

const SIGKILL_DELAY_MS = 1500;

function send(ws: TermSocket, payload: TermOutbound) {
  ws.send(JSON.stringify(payload));
}

/** Resolve cwd: explicit wins, then server-side fallback, else null (no project). */
function resolveCwd(cwd?: string): string | null {
  if (cwd && cwd.trim()) return cwd.trim();
  return fallbackProjectPath();
}

async function streamOutput(
  ws: TermSocket,
  stream: ReadableStream<Uint8Array> | null,
  id: string,
  streamName: "stdout" | "stderr"
) {
  if (!stream) return;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    if (text) send(ws, { type: "output", id, stream: streamName, text });
  }
  const flushed = decoder.decode();
  if (flushed) send(ws, { type: "output", id, stream: streamName, text: flushed });
}

type ProcRegistry = Map<string, Bun.Subprocess<"ignore", "pipe", "pipe">>;

async function runCommand(
  ws: TermSocket,
  registry: ProcRegistry,
  id: string,
  command: string,
  cwd?: string
) {
  const trimmed = command.trim();
  if (!trimmed) {
    send(ws, { type: "error", code: "EMPTY_COMMAND", message: "Command cannot be empty" });
    return;
  }

  const resolvedCwd = resolveCwd(cwd);
  if (!resolvedCwd) {
    send(ws, {
      type: "error",
      code: "NO_PROJECT",
      message: "No project open. Open a project to run commands.",
      retryable: false
    });
    return;
  }

  let proc: Bun.Subprocess<"ignore", "pipe", "pipe">;
  try {
    proc = Bun.spawn([shellConfig.shell, ...shellConfig.args, trimmed], {
      cwd: resolvedCwd,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe"
    });
  } catch (error) {
    send(ws, {
      type: "error",
      code: "SPAWN_FAILED",
      message: error instanceof Error ? error.message : "Failed to spawn command",
      retryable: false
    });
    return;
  }

  registry.set(id, proc);

  try {
    const [exitCode] = await Promise.all([
      proc.exited,
      streamOutput(ws, proc.stdout, id, "stdout"),
      streamOutput(ws, proc.stderr, id, "stderr")
    ]);
    send(ws, { type: "exit", id, code: exitCode });
  } catch (error) {
    send(ws, {
      type: "error",
      code: "RUN_FAILED",
      message: error instanceof Error ? error.message : "Terminal command failed",
      retryable: false
    });
  } finally {
    registry.delete(id);
  }
}

function cancelRun(ws: TermSocket, registry: ProcRegistry, id: string) {
  const proc = registry.get(id);
  if (!proc) {
    send(ws, {
      type: "error",
      code: "NOT_FOUND",
      message: `No running command with id ${id}`,
      retryable: false
    });
    return;
  }

  try {
    proc.kill("SIGTERM");
  } catch {
    // already dead — fine
  }

  // SIGKILL fallback if the process is still alive after the grace period.
  setTimeout(() => {
    if (registry.has(id)) {
      try {
        proc.kill("SIGKILL");
      } catch {
        // gone
      }
    }
  }, SIGKILL_DELAY_MS);
}

function killAll(registry: ProcRegistry) {
  for (const proc of registry.values()) {
    try {
      proc.kill("SIGKILL");
    } catch {
      // already dead
    }
  }
  registry.clear();
}

export const termRoutes = new Hono().get(
  "/",
  upgradeWebSocket(() => {
    const registry: ProcRegistry = new Map();

    return {
      onOpen(_event, ws) {
        send(ws, {
          type: "ready",
          capabilities: {
            run: true,
            interactive: false,
            cancel: true,
            shell: shellConfig.shell,
            platform: process.platform
          }
        });
      },
      onMessage(event, ws) {
        const data = asJson(event.data);
        if (!data) {
          send(ws, { type: "error", code: "BAD_FRAME", message: "Invalid JSON message", retryable: true });
          return;
        }

        if (data.type === "hello") {
          send(ws, { type: "ack", sessionId: data.sessionId || crypto.randomUUID() });
          return;
        }

        if (data.type === "ping") {
          send(ws, { type: "pong" });
          return;
        }

        if (data.type === "run") {
          void runCommand(ws, registry, data.id, data.command, data.cwd);
          return;
        }

        if (data.type === "cancel") {
          cancelRun(ws, registry, data.id);
          return;
        }

        send(ws, { type: "error", code: "UNKNOWN_MESSAGE", message: "Unsupported message type", retryable: true });
      },
      onClose(_event, _ws) {
        killAll(registry);
      }
    };
  })
);
