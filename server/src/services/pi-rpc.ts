import type { SandboxProcess } from "./sandbox";

export type PiEvent = Record<string, unknown> & { type?: string };

export interface PiRpcClient {
  prompt(text: string, opts?: { context?: string }): Promise<void>;
  abort(): Promise<void>;
  getState(): Promise<PiEvent>;
  subscribe(handler: (event: PiEvent) => void | Promise<void>): () => void;
  getStderr(): string;
  dispose(): Promise<void>;
}

export interface PiRpcOpts {
  onError?: (error: Error) => void;
}

type Handler = (event: PiEvent) => void | Promise<void>;

type PendingRequest = {
  command: string;
  resolve: (event: PiEvent) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type PromptWaiter = {
  resolve: () => void;
  reject: (error: Error) => void;
};

function isTurnEnd(event: PiEvent) {
  return event.type === "agent_end" || event.type === "turn_end" || event.type === "aborted" || event.type === "error" || event.type === "process_exit";
}

function eventError(event: PiEvent) {
  if (event.type === "error") return new Error(typeof event.message === "string" ? event.message : "pi RPC error");
  if (event.type === "process_exit") return new Error(`pi RPC process exited with code ${String(event.code ?? "unknown")}`);
  if (event.type === "response" && event.success === false) return new Error(typeof event.error === "string" ? event.error : "pi RPC command failed");
  if (event.type === "turn_end") {
    const message = event.message as { errorMessage?: unknown } | undefined;
    if (typeof message?.errorMessage === "string") return new Error(message.errorMessage);
  }
  return null;
}

export function attachPiRpc(process: SandboxProcess, opts: PiRpcOpts = {}): PiRpcClient {
  const handlers = new Set<Handler>();
  const writer = process.stdin.getWriter();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let pending = Promise.resolve();
  let buffer = "";
  let stderr = "";
  let disposed = false;
  let requestId = 0;
  const pendingRequests = new Map<string, PendingRequest>();
  let promptWaiter: PromptWaiter | null = null;

  const failPendingRequests = (error: Error) => {
    for (const [id, pendingRequest] of pendingRequests) {
      pendingRequests.delete(id);
      clearTimeout(pendingRequest.timeout);
      pendingRequest.reject(error);
    }
  };

  const emit = (event: PiEvent) => {
    if (event.type === "response" && typeof event.id === "string") {
      const pendingRequest = pendingRequests.get(event.id);
      if (pendingRequest) {
        pendingRequests.delete(event.id);
        clearTimeout(pendingRequest.timeout);
        if (event.success === false) {
          pendingRequest.reject(new Error(typeof event.error === "string" ? event.error : `${pendingRequest.command} failed`));
        } else {
          pendingRequest.resolve(event);
        }
        return;
      }

      if (event.success === false) {
        const errorEvent: PiEvent = {
          type: "error",
          message: typeof event.error === "string" ? event.error : "pi RPC command failed",
          command: event.command,
          id: event.id
        };
        if (promptWaiter) {
          promptWaiter.reject(eventError(errorEvent) ?? new Error("pi RPC command failed"));
          promptWaiter = null;
        }
        for (const handler of handlers) {
          void Promise.resolve(handler(errorEvent)).catch((error) => opts.onError?.(error instanceof Error ? error : new Error(String(error))));
        }
        return;
      }
    }
    if (isTurnEnd(event) && promptWaiter) {
      const error = eventError(event);
      if (error) promptWaiter.reject(error);
      else promptWaiter.resolve();
      promptWaiter = null;
    }
    for (const handler of handlers) {
      void Promise.resolve(handler(event)).catch((error) => opts.onError?.(error instanceof Error ? error : new Error(String(error))));
    }
  };

  const consume = async () => {
    const reader = process.stdout.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          const line = buffer.slice(0, newline).replace(/\r$/, "");
          buffer = buffer.slice(newline + 1);
          if (line.trim()) {
            try {
              emit(JSON.parse(line) as PiEvent);
            } catch (error) {
              opts.onError?.(error instanceof Error ? error : new Error(String(error)));
            }
          }
          newline = buffer.indexOf("\n");
        }
      }
      const rest = buffer + decoder.decode();
      if (rest.trim()) {
        try {
          emit(JSON.parse(rest) as PiEvent);
        } catch (error) {
          opts.onError?.(error instanceof Error ? error : new Error(String(error)));
        }
      }
    } catch (error) {
      opts.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  };

  const consumeStderr = async () => {
    const reader = process.stderr.getReader();
    const stderrDecoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        stderr += stderrDecoder.decode(value, { stream: true });
      }
      stderr += stderrDecoder.decode();
    } catch (error) {
      opts.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  };

  void consume();
  void consumeStderr();
  void process.exitCode.then((code) => {
    if (disposed) return;
    if (code === 0 && pendingRequests.size === 0 && !promptWaiter) return;
    const error = new Error(`pi RPC process exited with code ${code}`);
    failPendingRequests(error);
    emit({ type: "process_exit", code });
  });

  const writeJson = (payload: PiEvent) => {
    pending = pending.then(() => writer.write(encoder.encode(`${JSON.stringify(payload)}\n`)));
    return pending;
  };

  const send = async (command: PiEvent, timeoutMs = 30000) => {
    const id = `req_${++requestId}`;
    const payload = { ...command, id };
    const response = new Promise<PiEvent>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error(`Timeout waiting for response to ${String(command.type)}. Stderr: ${stderr}`));
      }, timeoutMs);
      pendingRequests.set(id, { command: String(command.type), resolve, reject, timeout });
    });
    await writeJson(payload);
    return response;
  };

  return {
    async prompt(text, promptOpts) {
      const message = promptOpts?.context ? `${text}\n\n---\n\n${promptOpts.context}` : text;
      const completion = new Promise<void>((resolve, reject) => {
        promptWaiter = { resolve, reject };
      });
      try {
        await send({ type: "prompt", message });
      } catch (error) {
        promptWaiter = null;
        throw error;
      }
      await completion;
    },
    async abort() {
      await send({ type: "abort" }, 5000);
    },
    async getState() {
      const response = await send({ type: "get_state" }, 5000);
      return (response.data as PiEvent | undefined) ?? response;
    },
    subscribe(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    getStderr() {
      return stderr;
    },
    async dispose() {
      disposed = true;
      failPendingRequests(new Error("RPC client disposed"));
      if (promptWaiter) {
        promptWaiter.reject(new Error("RPC client disposed"));
        promptWaiter = null;
      }
      try {
        await writer.close();
      } catch {
        // process may already be gone
      }
      await Promise.race([process.exitCode, new Promise((resolve) => setTimeout(resolve, 500))]);
      await process.kill("SIGTERM");
    }
  };
}
