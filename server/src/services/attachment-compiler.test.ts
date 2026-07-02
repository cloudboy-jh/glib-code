import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  compileAttachments,
  __setVisionSidecarForTests,
  __setVisionModelPickerForTests
} from "./attachment-compiler";
import { __setAttachmentForTests, type AttachmentMeta } from "../routes/attachments";

let dir = "";
const restores: Array<() => void> = [];

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "glib-attach-compiler-"));
  process.env.GLIB_CONFIG_DIR = join(dir, "config");
});

afterEach(async () => {
  while (restores.length) restores.pop()!();
  if (dir) await rm(dir, { recursive: true, force: true });
});

async function seed(meta: Omit<AttachmentMeta, "path">, contents: Uint8Array | string): Promise<AttachmentMeta> {
  const path = join(dir, `${meta.id}-${meta.name}`);
  await writeFile(path, contents);
  const full: AttachmentMeta = { ...meta, path };
  restores.push(__setAttachmentForTests(full));
  return full;
}

const opts = { provider: "anthropic", model: "claude" };

describe("compileAttachments", () => {
  test("returns nothing for empty input", async () => {
    expect(await compileAttachments([], opts)).toEqual([]);
  });

  test("skips unknown ids silently", async () => {
    expect(await compileAttachments(["nope"], opts)).toEqual([]);
  });

  test("compiles a text-like file into a high-fidelity block", async () => {
    await seed({ id: "t1", name: "hello.ts", type: "application/octet-stream", size: 20 }, "export const x = 1;\n");
    const [artifact] = await compileAttachments(["t1"], opts);
    expect(artifact.id).toBe("t1");
    expect(artifact.block).toContain('kind="text"');
    expect(artifact.block).toContain('fidelity="high"');
    expect(artifact.block).toContain("export const x = 1;");
    expect(artifact.block).not.toContain("[truncated");
  });

  test("truncates oversized text with a byte marker", async () => {
    const big = "a".repeat(20 * 1024);
    await seed({ id: "t2", name: "big.txt", type: "text/plain", size: big.length }, big);
    const [artifact] = await compileAttachments(["t2"], opts);
    expect(artifact.block).toContain(`[truncated: ${16 * 1024} of ${big.length} bytes]`);
  });

  test("emits a binary metadata block for unknown types", async () => {
    await seed({ id: "b1", name: "data.bin", type: "application/octet-stream", size: 3 }, new Uint8Array([1, 2, 3]));
    // .bin is not in the code-ext set and type is generic -> binary
    const [artifact] = await compileAttachments(["b1"], opts);
    expect(artifact.block).toContain('kind="binary"');
    expect(artifact.block).toContain('size="3"');
    expect(artifact.block).toContain('type="application/octet-stream"');
  });

  test("compiles an image via the vision sidecar", async () => {
    restores.push(__setVisionModelPickerForTests(async () => ({ provider: "anthropic", model: "claude-3-haiku" })));
    restores.push(
      __setVisionSidecarForTests(async () => "class: terminal_screenshot\n\n$ ls\nfile.txt")
    );
    await seed({ id: "i1", name: "shot.png", type: "image/png", size: 100 }, new Uint8Array([0x89, 0x50]));
    const [artifact] = await compileAttachments(["i1"], opts);
    expect(artifact.block).toContain('kind="image"');
    expect(artifact.block).toContain('class="terminal_screenshot"');
    expect(artifact.block).toContain('fidelity="approx"');
    expect(artifact.block).toContain("$ ls");
  });

  test("passes the session provider/model to the vision picker", async () => {
    let seen: { provider: string; model: string } | null = null;
    restores.push(
      __setVisionModelPickerForTests(async (session) => {
        seen = session;
        return session;
      })
    );
    restores.push(__setVisionSidecarForTests(async () => "class: photo\n\na cat"));
    await seed({ id: "i5", name: "shot.png", type: "image/png", size: 100 }, new Uint8Array([0x89, 0x50]));
    await compileAttachments(["i5"], { provider: "openai", model: "gpt-4o" });
    expect(seen).toEqual({ provider: "openai", model: "gpt-4o" });
  });

  test("degrades to fidelity=none when the sidecar fails", async () => {
    restores.push(__setVisionModelPickerForTests(async () => ({ provider: "anthropic", model: "claude-3-haiku" })));
    restores.push(
      __setVisionSidecarForTests(async () => {
        throw new Error("boom");
      })
    );
    await seed({ id: "i2", name: "shot.png", type: "image/png", size: 100 }, new Uint8Array([0x89, 0x50]));
    const [artifact] = await compileAttachments(["i2"], opts);
    expect(artifact.block).toContain('kind="image"');
    expect(artifact.block).toContain('fidelity="none"');
    expect(artifact.block).toContain("content unavailable");
  });

  test("degrades to fidelity=none when no vision provider is available", async () => {
    restores.push(__setVisionModelPickerForTests(async () => null));
    await seed({ id: "i3", name: "shot.png", type: "image/png", size: 100 }, new Uint8Array([0x89, 0x50]));
    const [artifact] = await compileAttachments(["i3"], opts);
    expect(artifact.block).toContain('fidelity="none"');
    expect(artifact.block).toContain("no vision-capable provider");
  });

  test("skips oversized images with a metadata-only block noting the limit", async () => {
    // maxImageAttachmentMb defaults to 10; make the image exceed it.
    const size = 11 * 1024 * 1024;
    restores.push(__setVisionModelPickerForTests(async () => ({ provider: "anthropic", model: "claude-3-haiku" })));
    restores.push(
      __setVisionSidecarForTests(async () => {
        throw new Error("should not be called for oversized images");
      })
    );
    await seed({ id: "i4", name: "huge.png", type: "image/png", size }, new Uint8Array([0x89]));
    const [artifact] = await compileAttachments(["i4"], opts);
    expect(artifact.block).toContain('fidelity="none"');
    expect(artifact.block).toContain("exceeds the 10MB limit");
  });
});
