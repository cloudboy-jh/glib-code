import { refreshPiModels } from "./pi-core";

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

    const providers: ProviderCapability[] = [...byProvider.entries()]
      .map(([id, modelIds]) => ({
        id,
        hasAuth: modelRegistry.getProviderAuthStatus(id).configured,
        modelIds: [...modelIds.values()]
      }))
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
