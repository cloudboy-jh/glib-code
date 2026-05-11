import { describe, expect, test } from "bun:test";
import { attachPiRpc } from "./pi-rpc";
import type { SandboxProcess } from "./sandbox";

function makeProcess(lines: string[], chunkSizes: number[]): SandboxProcess {
  const bytes = new TextEncoder().encode(lines.join("\n") + "\n");
  const chunks: Uint8Array[] = [];
  let offset = 0;
  let sizeIndex = 0;
  while (offset < bytes.length) {
    const size = chunkSizes[sizeIndex++ % chunkSizes.length] ?? bytes.length;
    chunks.push(bytes.slice(offset, Math.min(bytes.length, offset + size)));
    offset += size;
  }

  let writes = "";
  return {
    stdin: new WritableStream<Uint8Array>({
      write(chunk) {
        writes += new TextDecoder().decode(chunk);
      }
    }),
    stdout: new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      }
    }),
    stderr: new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } }),
    exitCode: Promise.resolve(0),
    kill: async () => { void writes; return; }
  };
}

async function collect(lines: string[], chunks: number[]) {
  const events: unknown[] = [];
  const client = attachPiRpc(makeProcess(lines, chunks));
  client.subscribe((event) => {
    events.push(event);
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  return events;
}

describe("attachPiRpc", () => {
  test("emits the same JSONL events across arbitrary chunk boundaries", async () => {
    const lines = [
      JSON.stringify({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "hi" } }),
      JSON.stringify({ type: "tool_execution_start", toolCallId: "1", toolName: "bash", args: { cmd: "pwd" } }),
      JSON.stringify({ type: "turn_end" })
    ];
    await expect(collect(lines, [1, 2, 3])).resolves.toEqual(await collect(lines, [999]));
  });

  test("splits only on LF, not Unicode line/paragraph separators", async () => {
    const text = "a\u2028b\u2029c";
    const events = await collect([JSON.stringify({ type: "message_update", text })], [1]);
    expect(events).toEqual([{ type: "message_update", text }]);
  });

  test("prompt sends real RPC message command and waits for turn_end", async () => {
    let stdout!: ReadableStreamDefaultController<Uint8Array>;
    const writes: unknown[] = [];
    const proc: SandboxProcess = {
      stdin: new WritableStream<Uint8Array>({
        write(chunk) {
          const line = new TextDecoder().decode(chunk).trim();
          const command = JSON.parse(line) as { id: string; type: string; message: string };
          writes.push(command);
          stdout.enqueue(new TextEncoder().encode(`${JSON.stringify({ id: command.id, type: "response", command: command.type, success: true })}\n`));
          stdout.enqueue(new TextEncoder().encode(`${JSON.stringify({ type: "turn_end", messages: [] })}\n`));
        }
      }),
      stdout: new ReadableStream<Uint8Array>({
        start(controller) {
          stdout = controller;
        }
      }),
      stderr: new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } }),
      exitCode: new Promise(() => {}),
      kill: async () => {}
    };

    const client = attachPiRpc(proc);
    await client.prompt("hello");
    expect(writes).toEqual([{ id: "req_1", type: "prompt", message: "hello" }]);
  });

  test("prompt rejects and emits error when pi reports async prompt failure", async () => {
    let stdout!: ReadableStreamDefaultController<Uint8Array>;
    const events: unknown[] = [];
    const proc: SandboxProcess = {
      stdin: new WritableStream<Uint8Array>({
        write(chunk) {
          const line = new TextDecoder().decode(chunk).trim();
          const command = JSON.parse(line) as { id: string; type: string; message: string };
          stdout.enqueue(new TextEncoder().encode(`${JSON.stringify({ id: command.id, type: "response", command: command.type, success: true })}\n`));
          stdout.enqueue(new TextEncoder().encode(`${JSON.stringify({ id: command.id, type: "response", command: command.type, success: false, error: "No API key found" })}\n`));
        }
      }),
      stdout: new ReadableStream<Uint8Array>({
        start(controller) {
          stdout = controller;
        }
      }),
      stderr: new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } }),
      exitCode: new Promise(() => {}),
      kill: async () => {}
    };

    const client = attachPiRpc(proc);
    client.subscribe((event) => {
      events.push(event);
    });

    await expect(client.prompt("hello")).rejects.toThrow("No API key found");
    expect(events).toEqual([{ type: "error", message: "No API key found", command: "prompt", id: "req_1" }]);
  });

  test("prompt rejects when RPC process exits before turn completion", async () => {
    let stdout!: ReadableStreamDefaultController<Uint8Array>;
    let resolveExit!: (code: number) => void;
    const proc: SandboxProcess = {
      stdin: new WritableStream<Uint8Array>({
        write(chunk) {
          const line = new TextDecoder().decode(chunk).trim();
          const command = JSON.parse(line) as { id: string; type: string; message: string };
          stdout.enqueue(new TextEncoder().encode(`${JSON.stringify({ id: command.id, type: "response", command: command.type, success: true })}\n`));
          resolveExit(1);
          return;
        }
      }),
      stdout: new ReadableStream<Uint8Array>({
        start(controller) {
          stdout = controller;
        }
      }),
      stderr: new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } }),
      exitCode: new Promise<number>((resolve) => { resolveExit = resolve; }),
      kill: async () => {}
    };

    const client = attachPiRpc(proc);
    await expect(client.prompt("hello")).rejects.toThrow("pi RPC process exited with code 1");
  });
});
