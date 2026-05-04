import { join } from "node:path";
import { GitTrix } from "gittrix/packages/core/src/gittrix.js";
import { BaselineConflictError } from "gittrix/packages/core/src/errors.js";
import type { DurableAdapter, EphemeralAdapter, PromoteOpts, PromoteResult, UserSession } from "gittrix/packages/core/src/types.js";
import { GitHubDurableAdapter, CloudflareArtifactsEphemeralAdapter } from "./gittrix-cloud-adapters";
import { LocalDurableAdapter, LocalEphemeralAdapter } from "./gittrix-local-adapter";
import { getConfigDir } from "../lib/paths";
import { getSettings, type Settings } from "./state";

export type StartGitTrixSessionResult = {
  gittrixSessionId: string;
  ephemeralPath: string;
  baselineSha: string;
};

export type BaselineConflict = {
  code: "BASELINE_CONFLICT";
  conflictingFiles: string[];
  durableSha: string;
  baselineSha: string;
};

type RuntimeProviders = Pick<Settings, "durableProvider" | "ephemeralProvider">;

const runtimes = new Map<string, { instance: GitTrix; ready: Promise<void>; providers: RuntimeProviders }>();

function sessionsRoot() {
  return join(getConfigDir(), "gittrix-sessions");
}

function cloudflareEphemeralRoot() {
  return join(getConfigDir(), "gittrix-cloudflare-ephemeral");
}

function mirrorsRoot(provider: string) {
  return join(getConfigDir(), "gittrix-mirrors", provider);
}

async function getRuntime(projectPath: string, branch?: string) {
  const settings = await getSettings();
  const providers = {
    durableProvider: settings.durableProvider,
    ephemeralProvider: settings.ephemeralProvider
  } satisfies RuntimeProviders;
  const key = `${projectPath}::${branch ?? "main"}::${providers.durableProvider}::${providers.ephemeralProvider}`;
  const existing = runtimes.get(key);
  if (existing) {
    await existing.ready;
    return existing.instance;
  }

  const instance = new GitTrix({
    durable: await createDurableAdapter(projectPath, branch ?? "main", providers.durableProvider),
    ephemeral: createEphemeralAdapter(providers.ephemeralProvider)
  });
  const ready = instance.init();
  runtimes.set(key, { instance, ready, providers });
  await ready;
  return instance;
}

async function createDurableAdapter(projectPath: string, branch: string, provider: Settings["durableProvider"]): Promise<DurableAdapter> {
  if (provider === "local") return new LocalDurableAdapter({ path: projectPath, branch });
  if (provider === "github") {
    const remoteUrl = await getRemoteUrl(projectPath);
    const repo = parseGitHubRemote(remoteUrl);
    if (!repo) throw new Error("GitHub durable provider requires a GitHub origin remote");
    return new GitHubDurableAdapter({
      owner: repo.owner,
      repo: repo.repo,
      branch,
      remoteUrl,
      tokenProvider: getGitHubToken,
      mirrorRoot: mirrorsRoot("github")
    });
  }

  throw new Error(`Unsupported durable provider: ${provider}`);
}

function createEphemeralAdapter(provider: Settings["ephemeralProvider"]): EphemeralAdapter {
  if (provider === "local") return new LocalEphemeralAdapter({ sessionsRootDir: sessionsRoot() });
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
  if (!accountId || !apiToken) throw new Error("Cloudflare Artifacts ephemeral provider requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN");
  return new CloudflareArtifactsEphemeralAdapter({
    accountId,
    apiToken,
    namespace: process.env.CLOUDFLARE_ARTIFACTS_NAMESPACE || process.env.CF_ARTIFACTS_NAMESPACE,
    workingRoot: cloudflareEphemeralRoot()
  });
}

async function getRemoteUrl(projectPath: string) {
  const proc = Bun.spawn({ cmd: ["git", "remote", "get-url", "origin"], cwd: projectPath, stdout: "pipe", stderr: "pipe" });
  const code = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  if (code !== 0) throw new Error(stderr.trim() || "git remote get-url origin failed");
  return stdout.trim();
}

export async function getGitHubToken() {
  const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (envToken) return envToken;
  const proc = Bun.spawn({ cmd: ["gh", "auth", "token"], stdout: "pipe", stderr: "pipe" });
  const code = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  if (code !== 0) return "";
  return stdout.trim();
}

function parseGitHubRemote(remoteUrl: string) {
  const https = remoteUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/i);
  if (https) return { owner: https[1], repo: https[2] };
  const ssh = remoteUrl.match(/^git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?$/i);
  if (ssh) return { owner: ssh[1], repo: ssh[2] };
  return null;
}

function ephemeralWorkspacePath(provider: Settings["ephemeralProvider"], sessionId: string) {
  return join(provider === "local" ? sessionsRoot() : cloudflareEphemeralRoot(), sessionId, provider === "local" ? "workspace" : "");
}

async function getUserSession(projectPath: string, gittrixSessionId: string, branch?: string): Promise<UserSession> {
  const rt = await getRuntime(projectPath, branch);
  return rt.getSession(gittrixSessionId);
}

export async function startSession(params: { projectPath: string; task: string; branch?: string }): Promise<StartGitTrixSessionResult> {
  const rt = await getRuntime(params.projectPath, params.branch);
  const settings = await getSettings();
  const session = await rt.startSession({ task: params.task, durablePath: params.projectPath, durableBranch: params.branch });
  const all = await rt.listSessions();
  const meta = all.find((item) => item.id === session.id);
  const fallbackPath = ephemeralWorkspacePath(settings.ephemeralProvider, session.id);
  return {
    gittrixSessionId: session.id,
    ephemeralPath: fallbackPath || normalizeLocalRef(meta?.ephemeralRef),
    baselineSha: meta?.baselineSha ?? ""
  };
}

function normalizeLocalRef(ref?: string) {
  if (!ref) return "";
  let path = ref.split("#")[0] ?? "";
  path = path.replace(/^local:\/\/\//, "").replace(/^local:\/\//, "");
  if (/^[A-Za-z]:\//.test(path)) return path;
  return path;
}

export async function diff(projectPath: string, gittrixSessionId: string, branch?: string) {
  const session = await getUserSession(projectPath, gittrixSessionId, branch);
  return session.diff();
}

export async function promote(
  projectPath: string,
  gittrixSessionId: string,
  opts: PromoteOpts,
  branch?: string
): Promise<PromoteResult> {
  try {
    const session = await getUserSession(projectPath, gittrixSessionId, branch);
    return await session.promote(opts);
  } catch (error) {
    if (error instanceof BaselineConflictError) {
      const payload: BaselineConflict = {
        code: "BASELINE_CONFLICT",
        conflictingFiles: error.conflictingFiles,
        durableSha: error.durableSha,
        baselineSha: error.baselineSha
      };
      throw payload;
    }
    throw error;
  }
}

export async function evict(projectPath: string, gittrixSessionId: string, branch?: string) {
  const rt = await getRuntime(projectPath, branch);
  await rt.evict(gittrixSessionId, "discarded");
}
