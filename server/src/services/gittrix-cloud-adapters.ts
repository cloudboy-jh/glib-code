import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { AuthError } from "gittrix/packages/core/src/errors.js";
import type { AdapterCapabilities, DurableAdapter, ListEntry, EphemeralAdapter } from "gittrix/packages/core/src/types.js";

type GitResult = { stdout: string; stdoutBytes: Uint8Array };

export type GitHubTokenProvider = () => Promise<string> | string;

export type GitHubDurableAdapterOptions = {
  owner: string;
  repo: string;
  branch?: string;
  token?: string;
  tokenProvider?: GitHubTokenProvider;
  mirrorRoot?: string;
  remoteUrl?: string;
  apiBaseUrl?: string;
  gitUserName?: string;
  gitUserEmail?: string;
};

export type CloudflareArtifactsOptions = {
  accountId: string;
  apiToken: string;
  namespace?: string;
};

export type CloudflareArtifactsEphemeralOptions = CloudflareArtifactsOptions & {
  workingRoot?: string;
};

export class GitHubDurableAdapter implements DurableAdapter {
  private readonly branch: string;
  private lastFetchAt = 0;

  public constructor(private readonly options: GitHubDurableAdapterOptions) {
    this.branch = options.branch ?? "main";
  }

  public capabilities(): AdapterCapabilities {
    return { git: true, push: true, fetch: true, history: true, ttl: false, latencyClass: "regional" };
  }

  public async getHead(branch = this.branch): Promise<string> {
    const mirrorPath = await this.ensureMirror();
    await this.ensureBranch(mirrorPath, branch);
    return (await runGit(["rev-parse", branch], mirrorPath)).stdout.trim();
  }

  public async readAtSha(sha: string, path: string): Promise<Uint8Array> {
    const result = await runGit(["show", `${sha}:${normalizePath(path)}`], await this.ensureMirror());
    return result.stdoutBytes;
  }

  public async listAtSha(sha: string, path = "."): Promise<ListEntry[]> {
    const args = path === "." ? ["ls-tree", "-r", "--name-only", sha] : ["ls-tree", "-r", "--name-only", sha, "--", normalizePath(path)];
    return listTreeResult(await runGit(args, await this.ensureMirror()));
  }

  public async changedFilesBetween(fromSha: string, toSha: string): Promise<string[]> {
    const result = await runGit(["diff", "--name-only", `${fromSha}...${toSha}`], await this.ensureMirror());
    return result.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
  }

  public async applyCommit(opts: { files: Record<string, Uint8Array | null>; message: string; branch?: string }): Promise<{ sha: string; branch: string }> {
    const branch = opts.branch ?? this.branch;
    const mirrorPath = await this.ensureMirror();
    await this.ensureBranch(mirrorPath, branch);
    await runGit(["checkout", branch], mirrorPath);
    await runGit(["config", "user.name", this.options.gitUserName ?? "gittrix-bot"], mirrorPath);
    await runGit(["config", "user.email", this.options.gitUserEmail ?? "gittrix-bot@users.noreply.github.com"], mirrorPath);

    for (const [file, bytes] of Object.entries(opts.files)) {
      const destination = join(mirrorPath, normalizePath(file));
      if (bytes === null) await rm(destination, { force: true });
      else {
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(destination, bytes);
      }
    }

    const fileList = Object.keys(opts.files);
    await runGit(["add", "-A", "--", ...fileList], mirrorPath);
    const staged = await runGit(["diff", "--cached", "--name-only", "--", ...fileList], mirrorPath);
    if (!staged.stdout.trim()) throw new Error("No staged changes for selected files");
    await runGit(["commit", "-m", opts.message], mirrorPath);
    await runGit(["push", "origin", `HEAD:refs/heads/${branch}`], mirrorPath);
    const sha = (await runGit(["rev-parse", "HEAD"], mirrorPath)).stdout.trim();
    return { sha, branch };
  }

  private async ensureMirror(): Promise<string> {
    const remote = this.remoteUrl();
    const mirrorPath = this.mirrorPath(remote);
    await mkdir(dirname(mirrorPath), { recursive: true });
    if (!(await isGitRepo(mirrorPath))) {
      await rm(mirrorPath, { recursive: true, force: true });
      await runGit(["clone", await this.authedRemote(remote), mirrorPath], process.cwd());
      this.lastFetchAt = Date.now();
    } else {
      await runGit(["remote", "set-url", "origin", await this.authedRemote(remote)], mirrorPath);
      const now = Date.now();
      if (now - this.lastFetchAt > 30_000) {
        await runGit(["fetch", "--prune", "origin"], mirrorPath);
        this.lastFetchAt = now;
      }
    }
    return mirrorPath;
  }

  private async ensureBranch(mirrorPath: string, branch: string): Promise<void> {
    if (await gitSucceeds(["show-ref", "--verify", "--quiet", `refs/remotes/origin/${branch}`], mirrorPath)) {
      await runGit(["checkout", "-B", branch, `origin/${branch}`], mirrorPath);
      return;
    }
    if (await gitSucceeds(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], mirrorPath)) {
      await runGit(["checkout", branch], mirrorPath);
      return;
    }
    await runGit(["checkout", "--orphan", branch], mirrorPath);
  }

  private mirrorPath(remoteUrl: string): string {
    const mirrorRoot = this.options.mirrorRoot ?? join(process.env.HOME ?? process.cwd(), ".gittrix", "github-mirrors");
    return resolve(mirrorRoot, createHash("sha256").update(remoteUrl).digest("hex").slice(0, 16));
  }

  private remoteUrl(): string {
    return this.options.remoteUrl ?? `https://github.com/${this.options.owner}/${this.options.repo}.git`;
  }

  private async authedRemote(remote: string): Promise<string> {
    const token = await this.getToken(false);
    if (!token) return remote;
    const url = new URL(remote);
    url.username = "x-access-token";
    url.password = token;
    return url.toString();
  }

  private async getToken(required = true): Promise<string> {
    const token = this.options.token ?? (await this.options.tokenProvider?.());
    if (!token && required) throw new AuthError("GitHub token is required");
    return token ?? "";
  }
}

export class CloudflareArtifactsEphemeralAdapter implements EphemeralAdapter {
  private readonly workingRoot: string;
  private readonly client: ArtifactsClient;

  public constructor(options: CloudflareArtifactsEphemeralOptions) {
    this.workingRoot = resolve(options.workingRoot ?? join(process.env.HOME ?? process.cwd(), ".gittrix", "cf-artifacts-ephemeral"));
    this.client = new ArtifactsClient(options);
  }

  public capabilities(): AdapterCapabilities {
    return { git: true, push: false, fetch: false, history: false, ttl: true, latencyClass: "regional" };
  }

  public async initWorkspace(sessionId: string): Promise<void> {
    const repoName = `gittrix-eph-${sessionId}`;
    const repo = await this.client.createRepo(repoName);
    const token = await this.client.mintToken(repoName);
    const path = this.sessionPath(sessionId);
    await rm(path, { recursive: true, force: true });
    try {
      await runGit(["clone", withAuthToken(repo.remote, token.token), path], process.cwd());
    } catch {
      await mkdir(path, { recursive: true });
    }
    await this.writeTouched(sessionId, []);
  }

  public async read(sessionId: string, path: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(join(this.sessionPath(sessionId), path)));
  }

  public async write(sessionId: string, path: string, bytes: Uint8Array): Promise<void> {
    const full = join(this.sessionPath(sessionId), path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, bytes);
    await this.markTouched(sessionId, path);
  }

  public async delete(sessionId: string, path: string): Promise<void> {
    await rm(join(this.sessionPath(sessionId), path), { force: true });
    await this.markTouched(sessionId, path);
  }

  public async exists(sessionId: string, path: string): Promise<boolean> {
    try {
      return (await stat(join(this.sessionPath(sessionId), path))).isFile();
    } catch {
      return false;
    }
  }

  public async list(sessionId: string, path = "."): Promise<ListEntry[]> {
    const out: ListEntry[] = [];
    const root = this.sessionPath(sessionId);
    await walk(root, join(root, normalizePath(path)), out);
    return out;
  }

  public async touchedFiles(sessionId: string): Promise<string[]> {
    return this.readTouched(sessionId);
  }

  public async destroy(sessionId: string): Promise<void> {
    await rm(this.sessionPath(sessionId), { recursive: true, force: true });
    await this.client.deleteRepo(`gittrix-eph-${sessionId}`);
  }

  private sessionPath(sessionId: string): string {
    return join(this.workingRoot, sessionId);
  }

  private touchedPath(sessionId: string): string {
    return join(this.sessionPath(sessionId), ".gittrix", ".gittrix-touched.json");
  }

  private async readTouched(sessionId: string): Promise<string[]> {
    try {
      const raw = await readFile(this.touchedPath(sessionId), "utf8");
      const data = JSON.parse(raw) as { files?: unknown };
      return Array.isArray(data.files) ? data.files.filter((v): v is string => typeof v === "string") : [];
    } catch {
      return [];
    }
  }

  private async writeTouched(sessionId: string, files: string[]): Promise<void> {
    const touchedPath = this.touchedPath(sessionId);
    await mkdir(dirname(touchedPath), { recursive: true });
    await writeFile(touchedPath, JSON.stringify({ files }, null, 2), "utf8");
  }

  private async markTouched(sessionId: string, path: string): Promise<void> {
    const files = await this.readTouched(sessionId);
    if (!files.includes(path)) {
      files.push(path);
      await this.writeTouched(sessionId, files);
    }
  }
}

class ArtifactsClient {
  private readonly accountId: string;
  private readonly apiToken: string;
  private readonly namespace: string;

  public constructor(opts: CloudflareArtifactsOptions) {
    this.accountId = opts.accountId;
    this.apiToken = opts.apiToken;
    this.namespace = opts.namespace ?? "default";
  }

  public async createRepo(name: string): Promise<{ id: string; remote: string; token: string; expires_at: string }> {
    return this.request("POST", "/repos", { name });
  }

  public async getRepo(name: string): Promise<{ id: string; name: string; remote: string; default_branch: string }> {
    return this.request("GET", `/repos/${encodeURIComponent(name)}`);
  }

  public async deleteRepo(name: string): Promise<void> {
    await this.request("DELETE", `/repos/${encodeURIComponent(name)}`);
  }

  public async mintToken(repoName: string): Promise<{ token: string; expires_at: string }> {
    return this.request("POST", `/repos/${encodeURIComponent(repoName)}/tokens`);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${this.accountId}/artifacts/namespaces/${this.namespace}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.apiToken}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (response.status === 401 || response.status === 403) throw new AuthError("Cloudflare Artifacts authentication failed");
    const data = (await response.json()) as { success: boolean; errors?: Array<{ code: number; message: string }>; result: T };
    if (!response.ok || !data.success) throw new Error(data.errors?.[0]?.message ?? "Cloudflare API request failed");
    return data.result;
  }
}

async function runGit(args: string[], cwd: string): Promise<GitResult> {
  const proc = Bun.spawn({ cmd: ["git", ...args], cwd, stdout: "pipe", stderr: "pipe" });
  const code = await proc.exited;
  const outBytes = new Uint8Array(await new Response(proc.stdout).arrayBuffer());
  const err = await new Response(proc.stderr).text();
  if (code !== 0) throw new Error(err.trim() || `git ${args.join(" ")} failed`);
  return { stdout: new TextDecoder().decode(outBytes), stdoutBytes: outBytes };
}

async function isGitRepo(path: string): Promise<boolean> {
  try {
    return (await stat(join(path, ".git"))).isDirectory();
  } catch {
    return false;
  }
}

async function gitSucceeds(args: string[], cwd: string): Promise<boolean> {
  try {
    await runGit(args, cwd);
    return true;
  } catch {
    return false;
  }
}

async function walk(root: string, dir: string, out: ListEntry[]): Promise<void> {
  let entries: Array<{ name: string; isDirectory(): boolean }>;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === ".gittrix") continue;
    const full = join(dir, entry.name);
    const rel = full.slice(root.length + 1).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      out.push({ path: rel, type: "dir" });
      await walk(root, full, out);
    } else {
      out.push({ path: rel, type: "file" });
    }
  }
}

function listTreeResult(result: GitResult): ListEntry[] {
  return result.stdout.split("\n").map((line) => line.trim()).filter(Boolean).map((filePath) => ({ path: filePath, type: "file" as const }));
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function withAuthToken(remote: string, token: string): string {
  const url = new URL(remote);
  url.username = "x-access-token";
  url.password = token;
  return url.toString();
}
