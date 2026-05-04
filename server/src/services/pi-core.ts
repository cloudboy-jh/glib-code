import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
import { getPiAuthPath } from "../lib/paths";

let authStorage: AuthStorage | null = null;
let modelRegistry: ModelRegistry | null = null;

async function normalizeAuthFile() {
  const path = getPiAuthPath();
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
    authStorage = AuthStorage.create(getPiAuthPath());
  }
  if (!modelRegistry) {
    modelRegistry = ModelRegistry.create(authStorage);
  }
  return { authStorage, modelRegistry };
}

export async function hasUsableProviderAuth(provider: string) {
  const { authStorage } = await getPiCore();
  const status = authStorage.getAuthStatus(provider);
  if (!status.source) return false;

  const credential = authStorage.get(provider) as { type?: string } | undefined;
  if (credential?.type === "oauth") {
    return authStorage.getOAuthProviders().some((oauthProvider) => oauthProvider.id === provider);
  }

  return true;
}

export async function validateProviderAuth(provider: string) {
  const { authStorage } = await getPiCore();
  const credential = authStorage.get(provider) as { type?: string } | undefined;
  if (credential?.type === "oauth" && !authStorage.getOAuthProviders().some((oauthProvider) => oauthProvider.id === provider)) {
    throw new Error(`Unsupported OAuth credentials for "${provider}". Add an API key for this provider in Settings.`);
  }

  const apiKey = await authStorage.getApiKey(provider, { includeFallback: true });
  if (!apiKey) throw new Error(`No API key found for "${provider}". Add one in Settings.`);
}

export async function refreshPiModels() {
  const core = await getPiCore();
  core.authStorage.reload();
  core.modelRegistry.refresh();
  return core;
}
