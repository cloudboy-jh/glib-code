type Cached<T> = { at: number; value: T };

export type ProviderCapability = {
  id: string;
  hasAuth: boolean;
  modelIds: string[];
};

export type OpencodeCapabilities = {
  ok: boolean;
  providers: ProviderCapability[];
  error?: string;
};

const TTL_MS = 15_000;
let cache: Cached<OpencodeCapabilities> | null = null;

async function run(cmd: string[]) {
  try {
    const proc = Bun.spawn({ cmd, stdout: "pipe", stderr: "pipe" });
    const code = await proc.exited;
    const out = await new Response(proc.stdout).text();
    const err = await new Response(proc.stderr).text();
    return { ok: code === 0, out: out.trim(), err: err.trim() };
  } catch (error) {
    return { ok: false, out: "", err: error instanceof Error ? error.message : String(error) };
  }
}

function parseAuthProviders(raw: string) {
  const providers = new Set<string>();
  for (const line of raw.split("\n")) {
    const value = line.trim();
    if (!value) continue;
    const token = value.split(/\s+/)[0]?.trim().toLowerCase();
    if (!token) continue;
    providers.add(token.replace(/[^a-z0-9_-]/g, ""));
  }
  return [...providers];
}

function parseModelList(raw: string) {
  const byProvider = new Map<string, Set<string>>();

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (!item || typeof item !== "object") continue;
        const model = (item as { id?: string; model?: string }).id ?? (item as { id?: string; model?: string }).model;
        const provider = (item as { provider?: string }).provider;
        if (!model || !provider) continue;
        const pid = String(provider).toLowerCase();
        const mid = String(model);
        const set = byProvider.get(pid) ?? new Set<string>();
        set.add(mid);
        byProvider.set(pid, set);
      }
    }
  } catch {
    // fallback below
  }

  if (!byProvider.size) {
    for (const line of raw.split("\n")) {
      const value = line.trim();
      if (!value) continue;
      const parts = value.split(/\s+/);
      const model = parts[0];
      const provider = parts[1]?.toLowerCase();
      if (!model || !provider) continue;
      const set = byProvider.get(provider) ?? new Set<string>();
      set.add(model);
      byProvider.set(provider, set);
    }
  }

  return byProvider;
}

async function discoverFresh(): Promise<OpencodeCapabilities> {
  const auth = await run(["opencode", "auth", "list"]);
  if (!auth.ok) {
    return { ok: false, providers: [], error: auth.err || "failed to query opencode auth" };
  }

  const providerIds = parseAuthProviders(auth.out);
  if (!providerIds.length) {
    return { ok: false, providers: [], error: "no authenticated opencode providers" };
  }

  const modelResult = await run(["opencode", "models", "list", "--json"]);
  const modelMap = modelResult.ok ? parseModelList(modelResult.out) : new Map<string, Set<string>>();

  const providers: ProviderCapability[] = providerIds.map((id) => ({
    id,
    hasAuth: true,
    modelIds: [...(modelMap.get(id)?.values() ?? [])]
  }));

  return { ok: true, providers };
}

export async function getOpencodeCapabilities(force = false) {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const value = await discoverFresh();
  cache = { at: Date.now(), value };
  return value;
}
