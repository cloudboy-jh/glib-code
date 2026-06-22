import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
import { getPiAuthPath } from "../lib/paths";
import { writeJsonAtomic } from "../lib/atomic-write";

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
      await writeJsonAtomic(path, parsed);
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

  // Mirror the actual session-spawn path: a provider is only authed if we can
  // retrieve a usable API key for it. Without this, providers that pi knows
  // about and have *any* ambient auth source (generic OPENAI_API_KEY env, gh
  // fallback, etc.) reported hasAuth=true even when no key was stored for them,
  // causing stale UI state and 404s on DELETE /providers/:id/auth.
  const apiKey = await authStorage.getApiKey(provider, { includeFallback: true });
  return Boolean(apiKey);
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
