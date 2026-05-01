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

  for (const rawLine of raw.split("\n")) {
    const line = stripAnsi(rawLine).trim();
    if (!line) continue;
    if (!line.includes("●")) continue;
    if (line.toLowerCase().includes("credentials")) continue;

    const afterBullet = line.split("●")[1]?.trim();
    if (!afterBullet) continue;
    const label = afterBullet.split(/\s{2,}/)[0]?.trim();
    if (!label) continue;
    providers.add(normalizeProviderId(label));
  }

  return [...providers].filter(Boolean);
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
  const modelResult = await run(["opencode", "models"]);
  if (!modelResult.ok) {
    return { ok: false, providers: [], error: modelResult.err || "failed to query opencode models" };
  }

  const modelMap = parseModelList(modelResult.out);
  const discoveredProviderIds = [...modelMap.keys()];

  const auth = await run(["opencode", "auth", "list"]);
  if (!auth.ok) {
    return { ok: false, providers: [], error: auth.err || "failed to query opencode auth" };
  }

  const authedProviderIds = new Set(parseAuthProviders(auth.out));
  if (!authedProviderIds.size) {
    return { ok: false, providers: [], error: "no authenticated opencode providers" };
  }

  const providers: ProviderCapability[] = discoveredProviderIds.map((id) => ({
    id,
    hasAuth: authedProviderIds.has(id),
    modelIds: [...(modelMap.get(id)?.values() ?? [])]
  })).filter((provider) => provider.hasAuth);

  return { ok: true, providers };
}

function normalizeProviderId(value: string) {
  const compact = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (compact === "moonshotai") return "moonshotai";
  if (compact === "zai") return "zai";
  if (compact === "openai") return "openai";
  if (compact === "anthropic") return "anthropic";
  return compact;
}

function stripAnsi(value: string) {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

export async function getOpencodeCapabilities(force = false) {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const value = await discoverFresh();
  cache = { at: Date.now(), value };
  return value;
}
