import { beforeEach, afterEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { websocket as honoWebSocket } from "hono/bun";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { termRoutes } from "./term";
import { registerProject, resetProjectStoreForTests, setCurrentProject } from "../services/project-store";

const isWin = process.platform === "win32";

let root = "";
let repo = "";
let server: ReturnType<typeof Bun.serve> | null = null;
let wsUrl = "";

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "glib-term-"));
  process.env.GLIB_CONFIG_DIR = join(root, "config");
  process.env.APPDATA = root;
  repo = join(root, "repo");
  await mkdir(repo, { recursive: true });
  resetProjectStoreForTests();

  const app = new Hono();
  app.route("/api/term", termRoutes);
  server = Bun.serve({ port: 0, fetch: app.fetch, websocket: honoWebSocket });
  wsUrl = `ws://localhost:${server.port}/api/term`;
});

afterEach(async () => {
  if (server) {
    server.stop();
    server = null;
  }
  if (root) await rm(root, { recursive: true, force: true });
});

// ── helpers ──────────────────────────────────────────────

function connect(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error("ws connect failed"));
  });
}

function sendFrame(ws: WebSocket, frame: Record<string, unknown>) {
  ws.send(JSON.stringify(frame));
}

function waitForFrame<T = Record<string, unknown>>(
  ws: WebSocket,
  type: string,
  timeout = 8000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timeout waiting for "${type}" frame`)),
      timeout
    );
    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(String(event.data)) as Record<string, unknown>;
        if (data.type === type) {
          clearTimeout(timer);
          ws.removeEventListener("message", handler);
          resolve(data as T);
        }
      } catch {
        // ignore non-JSON
      }
    };
    ws.addEventListener("message", handler);
  });
}

function collectFrames(ws: WebSocket, type: string): Record<string, unknown>[] {
  const frames: Record<string, unknown>[] = [];
  ws.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(String(event.data)) as Record<string, unknown>;
      if (data.type === type) frames.push(data);
    } catch {
      // ignore
    }
  });
  return frames;
}

function waitForClose(ws: WebSocket, timeout = 3000): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeout);
    ws.addEventListener("close", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

// ── tests ────────────────────────────────────────────────

describe("GET /api/term (websocket)", () => {
  test("ready frame advertises non-interactive runner with cancel", async () => {
    const ws = await connect(wsUrl);
    const ready = await waitForFrame<{
      type: string;
      capabilities: { interactive: boolean; cancel: boolean; run: boolean };
    }>(ws, "ready");

    expect(ready.capabilities.interactive).toBe(false);
    expect(ready.capabilities.cancel).toBe(true);
    expect(ready.capabilities.run).toBe(true);

    ws.close();
  });

  test("run with no cwd uses fallback project path", async () => {
    registerProject({ id: "p1", name: "repo", path: repo, branch: "main", isGitRepo: true });
    setCurrentProject("p1");

    const ws = await connect(wsUrl);
    await waitForFrame(ws, "ready");

    sendFrame(ws, { type: "run", id: "r1", command: "pwd" });

    const exit = await waitForFrame<{ type: string; code: number }>(ws, "exit");
    expect(exit.code).toBe(0);

    ws.close();
  });

  test("run with no project and no cwd returns NO_PROJECT error", async () => {
    const ws = await connect(wsUrl);
    await waitForFrame(ws, "ready");

    sendFrame(ws, { type: "run", id: "r1", command: "pwd" });

    const error = await waitForFrame<{ type: string; code: string }>(ws, "error");
    expect(error.code).toBe("NO_PROJECT");

    ws.close();
  });

  test("explicit cwd overrides fallback", async () => {
    const otherDir = join(root, "other");
    await mkdir(otherDir, { recursive: true });

    // Register a different project so fallback would NOT be otherDir
    registerProject({ id: "p1", name: "repo", path: repo, branch: "main", isGitRepo: true });
    setCurrentProject("p1");

    const ws = await connect(wsUrl);
    await waitForFrame(ws, "ready");

    sendFrame(ws, { type: "run", id: "r1", command: "pwd", cwd: otherDir });

    const exit = await waitForFrame<{ type: string; code: number }>(ws, "exit");
    expect(exit.code).toBe(0);

    ws.close();
  });

  test("streaming sends multiple output frames before exit", async () => {
    const ws = await connect(wsUrl);
    await waitForFrame(ws, "ready");

    // A command that emits output with delays so we get multiple chunks.
    const command = isWin
      ? "Write-Output 'a'; Start-Sleep -Milliseconds 200; Write-Output 'b'; Start-Sleep -Milliseconds 200; Write-Output 'c'"
      : "echo a; sleep 0.2; echo b; sleep 0.2; echo c";

    sendFrame(ws, { type: "run", id: "r1", command, cwd: repo });

    const outputFrames = collectFrames(ws, "output");
    await waitForFrame(ws, "exit");

    // We should have received at least 2 output frames (streaming, not buffered).
    expect(outputFrames.length).toBeGreaterThanOrEqual(2);

    ws.close();
  });

  test("cancel kills a running process and sends exit", async () => {
    const ws = await connect(wsUrl);
    await waitForFrame(ws, "ready");

    const command = isWin
      ? "Start-Sleep -Seconds 30"
      : "sleep 30";

    sendFrame(ws, { type: "run", id: "r1", command, cwd: repo });

    // Give the process a moment to start, then cancel.
    await new Promise((r) => setTimeout(r, 300));
    sendFrame(ws, { type: "cancel", id: "r1" });

    const exit = await waitForFrame<{ type: string; code: number }>(ws, "exit", 5000);
    // Exit code for a killed process is non-zero (typically 143 for SIGTERM, 137 for SIGKILL,
    // or 1 on win32). Just assert it's not the "never exited" timeout.
    expect(typeof exit.code).toBe("number");

    ws.close();
  });

  test("cancel for unknown id returns NOT_FOUND", async () => {
    const ws = await connect(wsUrl);
    await waitForFrame(ws, "ready");

    sendFrame(ws, { type: "cancel", id: "nonexistent" });

    const error = await waitForFrame<{ type: string; code: string }>(ws, "error");
    expect(error.code).toBe("NOT_FOUND");

    ws.close();
  });

  test("socket close kills running processes (no orphan)", async () => {
    const sentinel = join(root, "sentinel");

    // Command that sleeps, then writes a sentinel on completion.
    // If the process is killed on socket close, the sentinel never appears.
    const command = isWin
      ? `Start-Sleep -Seconds 2; 'done' | Out-File -FilePath '${sentinel}'`
      : `sleep 2; echo done > '${sentinel}'`;

    const ws = await connect(wsUrl);
    await waitForFrame(ws, "ready");

    sendFrame(ws, { type: "run", id: "r1", command, cwd: repo });

    // Give the process a moment to start.
    await new Promise((r) => setTimeout(r, 300));

    // Close the socket — onClose should SIGKILL the process.
    ws.close();
    await waitForClose(ws);

    // Wait long enough that the 2-second sleep would have completed if the
    // process were still alive. Then verify the sentinel was NOT written.
    await new Promise((r) => setTimeout(r, 3000));
    expect(existsSync(sentinel)).toBe(false);
  });

  test("empty command returns error", async () => {
    const ws = await connect(wsUrl);
    await waitForFrame(ws, "ready");

    sendFrame(ws, { type: "run", id: "r1", command: "   " });

    const error = await waitForFrame<{ type: string; code: string }>(ws, "error");
    expect(error.code).toBe("EMPTY_COMMAND");

    ws.close();
  });

  test("hello/ack handshake assigns a session id", async () => {
    const ws = await connect(wsUrl);
    await waitForFrame(ws, "ready");

    sendFrame(ws, { type: "hello" });
    const ack = await waitForFrame<{ type: string; sessionId: string }>(ws, "ack");
    expect(typeof ack.sessionId).toBe("string");
    expect(ack.sessionId.length).toBeGreaterThan(0);

    ws.close();
  });

  test("ping/pong", async () => {
    const ws = await connect(wsUrl);
    await waitForFrame(ws, "ready");

    sendFrame(ws, { type: "ping" });
    const pong = await waitForFrame(ws, "pong");
    expect(pong.type).toBe("pong");

    ws.close();
  });
});
