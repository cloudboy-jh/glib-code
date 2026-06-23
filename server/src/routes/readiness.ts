import { Hono } from "hono";
import type { ReadinessReport } from "@glib-code/shared/schemas/readiness";
import { getPiCapabilities } from "../services/pi-capabilities";

type Cached = {
  at: number;
  value: ReadinessReport;
};

let cache: Cached | null = null;
const TTL_MS = 30_000;

// Version strings don't change during a process lifetime — cache them with a
// long TTL so readiness recomputes only the provider/capability part on expiry.
type VersionCache = {
  at: number;
  git: { ok: boolean; out: string; err: string };
  pi: { ok: boolean; out: string; err: string };
  gh: { ok: boolean; out: string; err: string };
};

let versionCache: VersionCache | null = null;
const VERSION_TTL_MS = 3_600_000;

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

async function getVersionStrings(): Promise<VersionCache> {
  if (versionCache && Date.now() - versionCache.at < VERSION_TTL_MS) {
    return versionCache;
  }
  const [git, piVersion, gh] = await Promise.all([
    run(["git", "--version"]),
    run(["pi", "--version"]),
    run(["gh", "--version"])
  ]);
  versionCache = { at: Date.now(), git, pi: piVersion, gh };
  return versionCache;
}

export const readinessRoutes = new Hono().get("/", async (c) => {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return c.json(cache.value);
  }

  const versions = await getVersionStrings();
  const { git, pi: piVersion, gh } = versions;

  const capabilities = await getPiCapabilities();
  const readyProviders = capabilities.providers.filter((p) => p.hasAuth).map((p) => p.id);

  const value: ReadinessReport = {
    ok: git.ok && piVersion.ok && readyProviders.length > 0,
    checks: {
      git: {
        ok: git.ok,
        version: git.ok ? git.out : undefined,
        error: git.ok ? undefined : git.err || "git not found"
      },
      pi: {
        ok: piVersion.ok && readyProviders.length > 0,
        version: piVersion.ok ? piVersion.out : undefined,
        error: piVersion.ok ? (readyProviders.length ? undefined : "no providers configured") : piVersion.err || "pi not found",
        providers: readyProviders
      },
      gh: {
        ok: gh.ok,
        version: gh.ok ? gh.out.split("\n")[0] : undefined,
        error: gh.ok ? undefined : gh.err || "gh not found"
      }
    }
  };

  cache = { at: Date.now(), value };
  return c.json(value);
});
