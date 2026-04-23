import { Hono } from "hono";
import type { ReadinessReport } from "@glib-code/shared/schemas/readiness";

type Cached = {
  at: number;
  value: ReadinessReport;
};

let cache: Cached | null = null;
const TTL_MS = 30_000;

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

export const readinessRoutes = new Hono().get("/", async (c) => {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return c.json(cache.value);
  }

  const git = await run(["git", "--version"]);
  const opencodeVersion = await run(["opencode", "--version"]);
  const opencodeAuth = opencodeVersion.ok ? await run(["opencode", "auth", "list"]) : { ok: false, out: "", err: "opencode missing" };
  const gh = await run(["gh", "--version"]);

  const providers = opencodeAuth.out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const value: ReadinessReport = {
    ok: git.ok && opencodeVersion.ok && providers.length > 0,
    checks: {
      git: {
        ok: git.ok,
        version: git.ok ? git.out : undefined,
        error: git.ok ? undefined : git.err || "git not found"
      },
      opencode: {
        ok: opencodeVersion.ok && providers.length > 0,
        version: opencodeVersion.ok ? opencodeVersion.out : undefined,
        error: opencodeVersion.ok ? (providers.length ? undefined : "no providers configured") : opencodeVersion.err || "opencode not found",
        providers
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
