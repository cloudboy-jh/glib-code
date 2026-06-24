import { hasUsableProviderAuth, refreshPiModels } from "./pi-core";
import { getOpenRouterCatalog } from "./openrouter-catalog";

type Cached<T> = { at: number; value: T };

export type PiCapabilities = {
  ok: boolean;
  providers: ProviderCapability[];
  error?: string;
};

export type ProviderCapability = {
  id: string;
  hasAuth: boolean;
  modelIds: string[];
};

const TTL_MS = 15_000;
let cache: Cached<PiCapabilities> | null = null;

async function discoverFresh(): Promise<PiCapabilities> {
  try {
    const { modelRegistry } = await refreshPiModels();
    const all = modelRegistry.getAll();
    const byProvider = new Map<string, Set<string>>();

    for (const model of all) {
      const provider = model.provider;
      const id = model.id;
      const set = byProvider.get(provider) ?? new Set<string>();
      set.add(id);
      byProvider.set(provider, set);
    }

    // pi-ai ships a static OpenRouter snapshot. Union the live catalog in so the
    // picker reflects newly-released models. Fully fallback-guarded: on failure
    // getOpenRouterCatalog() returns [] and we keep the baked list as-is.
    try {
      const live = await getOpenRouterCatalog();
      if (live.length > 0) {
        const set = byProvider.get("openrouter") ?? new Set<string>();
        for (const model of live) set.add(model.id);
        byProvider.set("openrouter", set);
      }
    } catch {
      // never let catalog freshness break provider discovery
    }

    const providers: ProviderCapability[] = (await Promise.all([...byProvider.entries()]
      .map(async ([id, modelIds]) => ({
        id,
        hasAuth: await hasUsableProviderAuth(id),
        modelIds: [...modelIds.values()]
      }))))
      .sort((a, b) => a.id.localeCompare(b.id));

    return { ok: true, providers };
  } catch (error) {
    return { ok: false, providers: [], error: error instanceof Error ? error.message : String(error) };
  }
}

export async function getPiCapabilities(force = false) {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const value = await discoverFresh();
  cache = { at: Date.now(), value };
  return value;
}
