import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { attachPiRpc } from "./pi-rpc";
import { LocalSandbox } from "./sandbox";

describe("pi RPC integration", () => {
  test("spawns real pi RPC process and responds to get_state", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "glib-pi-rpc-"));
    try {
      const sandbox = new LocalSandbox({ id: "pi-rpc", cwd });
      const proc = await sandbox.spawn({
        cmd: process.env.GLIB_PI_RPC_CMD || "pi",
        args: (process.env.GLIB_PI_RPC_ARGS?.split(" ").filter(Boolean) ?? ["--mode", "rpc", "--no-session", "--offline", "--tools", "read"]),
        env: process.env as Record<string, string>
      });
      const client = attachPiRpc(proc);
      const state = await client.getState();
      expect(typeof state.sessionId).toBe("string");
      expect(typeof state.isStreaming).toBe("boolean");
      await client.dispose();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  }, 30000);
});
