import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getConfigDir } from "../lib/paths";
import { writeJsonAtomic } from "../lib/atomic-write";

// OpenRouter's catalog changes constantly. pi-ai ships a *static* snapshot baked
// into models.generated.js, so newly-released models never appear and dead ones
// linger. This service fetches the live catalog and lets pi-capabilities union
// the fresh model IDs into the openrouter provider.
//
// Design: stale-while-revalidate with a disk cache. Boot serves cache instantly;
// a background refresh updates it. Every failure path degrades gracefully and
// never throws into the picker — worst case we fall back to pi-ai's baked list.

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const FETCH_TIMEOUT_MS = 8_000;

export type OpenRouterModel = {
  id: string;
  name: string;
  contextWindow: number;
  reasoning: boolean;
  input: ("text" | "image")[];
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
};

type CacheFile = { fetchedAt: number; models: OpenRouterModel[] };

type RawModel = {
  id?: unknown;
  name?: unknown;
  context_length?: unknown;
  pricing?: { prompt?: unknown; completion?: unknown; input_cache_read?: unknown; input_cache_write?: unknown };
  architecture?: { input_modalities?: unknown };
  supported_parameters?: unknown;
  reasoning?: unknown;
};

let memoryCache: CacheFile | null = null;
let inflight: Promise<OpenRouterModel[]> | null = null;

function cachePath() {
  return join(getConfigDir(), "openrouter-models.json");
}

// OpenRouter prices are per-token USD strings; pi costs are per-million-token USD.
function perMillion(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : 0;
  return Number.isFinite(n) ? n * 1_000_000 : 0;
}

function mapModel(raw: RawModel): OpenRouterModel | null {
  if (typeof raw.id !== "string" || raw.id.length === 0) return null;

  const modalities = Array.isArray(raw.architecture?.input_modalities)
    ? (raw.architecture.input_modalities as unknown[]).filter((m): m is string => typeof m === "string")
    : [];
  const input: ("text" | "image")[] = [];
  if (modalities.includes("text") || modalities.length === 0) input.push("text");
  if (modalities.includes("image")) input.push("image");

  const supported = Array.isArray(raw.supported_parameters)
    ? (raw.supported_parameters as unknown[]).filter((p): p is string => typeof p === "string")
    : [];
  const reasoning = Boolean(raw.reasoning) || supported.includes("reasoning") || supported.includes("include_reasoning");

  return {
    id: raw.id,
    name: typeof raw.name === "string" && raw.name.length > 0 ? raw.name : raw.id,
    contextWindow: typeof raw.context_length === "number" && raw.context_length > 0 ? raw.context_length : 128_000,
    reasoning,
    input,
    cost: {
      input: perMillion(raw.pricing?.prompt),
      output: perMillion(raw.pricing?.completion),
      cacheRead: perMillion(raw.pricing?.input_cache_read),
      cacheWrite: perMillion(raw.pricing?.input_cache_write)
    }
  };
}

async function readDiskCache(): Promise<CacheFile | null> {
  if (memoryCache) return memoryCache;
  const path = cachePath();
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as CacheFile;
    if (!Array.isArray(parsed?.models)) return null;
    memoryCache = parsed;
    return parsed;
  } catch {
    return null;
  }
}

async function fetchFresh(): Promise<OpenRouterModel[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(OPENROUTER_MODELS_URL, {
      signal: controller.signal,
      headers: { accept: "application/json" }
    });
    if (!response.ok) throw new Error(`OpenRouter models HTTP ${response.status}`);
    const body = (await response.json()) as { data?: unknown };
    const data = Array.isArray(body?.data) ? body.data : [];
    const models = data
      .map((raw) => mapModel(raw as RawModel))
      .filter((m): m is OpenRouterModel => m !== null);
    if (models.length === 0) throw new Error("OpenRouter returned no models");

    const next: CacheFile = { fetchedAt: Date.now(), models };
    memoryCache = next;
    await writeJsonAtomic(cachePath(), next).catch(() => {
      // disk cache is best-effort; in-memory cache still serves this run
    });
    return models;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Live OpenRouter catalog with stale-while-revalidate semantics.
 *
 * - Fresh disk/memory cache (< TTL): return immediately, no network.
 * - Stale cache: return it now, kick a background refresh.
 * - No cache: await one fetch; on failure return [] (caller falls back to the
 *   pi-ai baked list).
 *
 * Never throws.
 */
export async function getOpenRouterCatalog(): Promise<OpenRouterModel[]> {
  const cache = await readDiskCache();
  const isFresh = cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS;

  if (cache && isFresh) return cache.models;

  if (cache && !isFresh) {
    // Stale-while-revalidate: serve stale, refresh in background.
    if (!inflight) {
      inflight = fetchFresh()
        .catch(() => cache.models)
        .finally(() => {
          inflight = null;
        });
      void inflight;
    }
    return cache.models;
  }

  // Cold start: no cache. Await a single fetch (deduped).
  if (!inflight) {
    inflight = fetchFresh()
      .catch(() => [] as OpenRouterModel[])
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Force a refresh, bypassing the TTL. Used by the manual refresh path. */
export async function refreshOpenRouterCatalog(): Promise<OpenRouterModel[]> {
  try {
    return await fetchFresh();
  } catch {
    return (await readDiskCache())?.models ?? [];
  }
}
