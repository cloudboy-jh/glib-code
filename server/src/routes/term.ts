import { Hono } from "hono";
import { upgradeWebSocket } from "hono/bun";

type TermInbound =
  | { type: "hello"; sessionId?: string }
  | { type: "run"; id: string; command: string; cwd?: string }
  | { type: "ping" };

type TermOutbound =
  | { type: "ready"; capabilities: { run: boolean; shell: string; platform: NodeJS.Platform } }
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

function send(ws: TermSocket, payload: TermOutbound) {
  ws.send(JSON.stringify(payload));
}

async function runCommand(ws: TermSocket, id: string, command: string, cwd?: string) {
  const trimmed = command.trim();
  if (!trimmed) {
    send(ws, { type: "error", code: "EMPTY_COMMAND", message: "Command cannot be empty" });
    return;
  }

  try {
    const proc = Bun.spawn([shellConfig.shell, ...shellConfig.args, trimmed], {
      cwd: cwd && cwd.trim() ? cwd : process.cwd(),
      stdout: "pipe",
      stderr: "pipe"
    });

    const [stdoutText, stderrText, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited
    ]);

    if (stdoutText) send(ws, { type: "output", id, stream: "stdout", text: stdoutText });
    if (stderrText) send(ws, { type: "output", id, stream: "stderr", text: stderrText });
    send(ws, { type: "exit", id, code: exitCode });
  } catch (error) {
    send(ws, {
      type: "error",
      code: "RUN_FAILED",
      message: error instanceof Error ? error.message : "Terminal command failed",
      retryable: false
    });
  }
}

export const termRoutes = new Hono().get(
  "/",
  upgradeWebSocket(() => ({
    onOpen(_event, ws) {
      send(ws, {
        type: "ready",
        capabilities: { run: true, shell: shellConfig.shell, platform: process.platform }
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
        void runCommand(ws, data.id, data.command, data.cwd);
        return;
      }

      send(ws, { type: "error", code: "UNKNOWN_MESSAGE", message: "Unsupported message type", retryable: true });
    },
    onClose(_event, _ws) {
      // no-op for now
    }
  }))
);
