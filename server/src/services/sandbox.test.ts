import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalSandbox } from "./sandbox";

async function readAll(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

describe("LocalSandbox", () => {
  test("spawns a process with stdin/stdout and exposes exitCode", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "glib-local-sandbox-"));
    try {
      const sandbox = new LocalSandbox({ id: "test", cwd });
      const proc = await sandbox.spawn({
        cmd: process.execPath,
        args: ["-e", "process.stdin.pipe(process.stdout)"]
      });
      const writer = proc.stdin.getWriter();
      await writer.write(new TextEncoder().encode("hello sandbox"));
      await writer.close();

      await expect(readAll(proc.stdout)).resolves.toBe("hello sandbox");
      await expect(proc.exitCode).resolves.toBe(0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
