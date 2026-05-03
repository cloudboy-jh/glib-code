import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
import { getOpencodeAuthPath } from "../lib/paths";

let authStorage: AuthStorage | null = null;
let modelRegistry: ModelRegistry | null = null;

async function normalizeAuthFile() {
  const path = getOpencodeAuthPath();
  if (!existsSync(path)) return;
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Record<string, { type?: string; key?: string }>;
    let changed = false;
    for (const [provider, value] of Object.entries(parsed)) {
      if (value?.type === "api") {
        parsed[provider] = { type: "api_key", key: value.key ?? "" };
        changed = true;
      }
    }
    if (changed) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(parsed, null, 2), "utf8");
    }
  } catch {
    // ignore malformed auth files
  }
}

export async function getPiCore() {
  await normalizeAuthFile();
  if (!authStorage) {
    authStorage = AuthStorage.create(getOpencodeAuthPath());
  }
  if (!modelRegistry) {
    modelRegistry = ModelRegistry.create(authStorage);
  }
  return { authStorage, modelRegistry };
}

export async function refreshPiModels() {
  const core = await getPiCore();
  core.authStorage.reload();
  core.modelRegistry.refresh();
  return core;
}
