import { randomUUID } from "node:crypto";
import { rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { ensureDir } from "./paths";

const writeLocks = new Map<string, Promise<unknown>>();

export async function withFileWriteLock<T>(path: string, fn: () => Promise<T>): Promise<T> {
  const previous = writeLocks.get(path) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.catch(() => undefined).then(() => current);
  writeLocks.set(path, queued);
  await previous.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
    if (writeLocks.get(path) === queued) writeLocks.delete(path);
  }
}

export async function writeTextAtomic(path: string, value: string): Promise<void> {
  await withFileWriteLock(path, async () => {
    await ensureDir(dirname(path));
    const tempPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(tempPath, value, "utf8");
    await rename(tempPath, path);
  });
}

export async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await writeTextAtomic(path, JSON.stringify(value, null, 2));
}
