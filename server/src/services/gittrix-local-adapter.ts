import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";

async function rmRetry(path: string, maxAttempts = 5, delayMs = 300): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await rm(path, { recursive: true, force: true });
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if ((code === "EBUSY" || code === "EPERM" || code === "EACCES") && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
        continue;
      }
      throw error;
    }
  }
}
import { dirname, join, relative, resolve } from "node:path";
import { parseLocalRefUri } from "gittrix/packages/core/src/ref.js";
import type { AdapterCapabilities, DurableAdapter, EphemeralAdapter, ListEntry } from "gittrix/packages/core/src/types.js";

type GitResult = { stdout: string; stdoutBytes: Uint8Array };

async function runGit(args: string[], cwd: string): Promise<GitResult> {
  const proc = Bun.spawn({ cmd: ["git", ...args], cwd, stdout: "pipe", stderr: "pipe" });
  const code = await proc.exited;
  const outBytes = new Uint8Array(await new Response(proc.stdout).arrayBuffer());
  const err = await new Response(proc.stderr).text();
  if (code !== 0) throw new Error(err.trim() || `git ${args.join(" ")} failed`);
  return { stdout: new TextDecoder().decode(outBytes), stdoutBytes: outBytes };
}

export class LocalDurableAdapter implements DurableAdapter {
  private readonly path: string;
  private readonly branch: string;

  public constructor(options: { path: string; branch?: string }) {
    this.path = resolve(options.path);
    this.branch = options.branch ?? "main";
  }

  public capabilities(): AdapterCapabilities {
    return { git: true, push: false, fetch: false, history: true, ttl: false, latencyClass: "local" };
  }

  public async getHead(branch = this.branch): Promise<string> {
    return (await runGit(["rev-parse", branch], this.path)).stdout.trim();
  }

  public async readAtSha(sha: string, path: string): Promise<Uint8Array> {
    const result = await runGit(["show", `${sha}:${normalizePath(path)}`], this.path);
    return result.stdoutBytes;
  }

  public async listAtSha(sha: string, path = "."): Promise<ListEntry[]> {
    const pathArg = path === "." ? "" : normalizePath(path);
    const result = await runGit(["ls-tree", "-r", "--name-only", sha, "--", pathArg], this.path);
    return result.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((filePath) => ({ path: filePath, type: "file" as const }));
  }

  public async changedFilesBetween(fromSha: string, toSha: string): Promise<string[]> {
    const result = await runGit(["diff", "--name-only", `${fromSha}...${toSha}`], this.path);
    return result.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  public async applyCommit(opts: { files: Record<string, Uint8Array | null>; message: string; branch?: string }): Promise<{ sha: string; branch: string }> {
    const branch = opts.branch ?? this.branch;
    for (const [file, bytes] of Object.entries(opts.files)) {
      const destination = join(this.path, file);
      if (bytes === null) {
        await rm(destination, { force: true });
      } else {
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(destination, bytes);
      }
    }

    const fileList = Object.keys(opts.files);
    await runGit(["add", "-A", "--", ...fileList], this.path);
    const staged = await runGit(["diff", "--cached", "--name-only", "--", ...fileList], this.path);
    if (!staged.stdout.trim()) throw new Error("No staged changes for selected files");
    await runGit(["commit", "-m", opts.message], this.path);
    const sha = (await runGit(["rev-parse", "HEAD"], this.path)).stdout.trim();
    return { sha, branch };
  }
}

export class LocalEphemeralAdapter implements EphemeralAdapter {
  private readonly sessionsRootDir: string;

  public constructor(options: { sessionsRootDir: string }) {
    this.sessionsRootDir = resolve(options.sessionsRootDir);
  }

  public capabilities(): AdapterCapabilities {
    return { git: true, push: false, fetch: false, history: true, ttl: false, latencyClass: "local" };
  }

  public async initWorkspace(sessionId: string, baseline: { durableRef: string; sha: string }): Promise<void> {
    const durable = parseLocalRefUri(baseline.durableRef);
    const durablePath = resolve(durable.path);
    const workspacePath = this.sessionPath(sessionId);
    await mkdir(this.sessionDir(sessionId), { recursive: true });
    await rmRetry(workspacePath);

    await ensureShaAvailable(durablePath, baseline.sha);

    let workspaceKind: "worktree" | "clone" = "worktree";
    try {
      await runGit(["worktree", "add", "--detach", workspacePath, baseline.sha], durablePath);
    } catch {
      workspaceKind = "clone";
      await rmRetry(workspacePath);
      await runGit(["clone", "--no-checkout", durablePath, workspacePath], durablePath);
      await runGit(["checkout", "--detach", baseline.sha], workspacePath);
    }

    await this.saveTouched(sessionId, []);
    await this.saveWorkspaceMetadata(sessionId, { durablePath, workspacePath, workspaceKind });
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
      const file = await stat(join(this.sessionPath(sessionId), path));
      return file.isFile();
    } catch {
      return false;
    }
  }

  public async list(sessionId: string, path = "."): Promise<ListEntry[]> {
    return listFilesRecursive(join(this.sessionPath(sessionId), path), this.sessionPath(sessionId));
  }

  public async touchedFiles(sessionId: string): Promise<string[]> {
    const touched = new Set(await this.loadTouched(sessionId));
    await this.addGitChangedFiles(sessionId, touched);
    return [...touched].sort((a, b) => a.localeCompare(b));
  }

  public async destroy(sessionId: string): Promise<void> {
    const info = await this.loadWorkspaceMetadata(sessionId);
    const workspacePath = this.sessionPath(sessionId);
    if (info?.workspaceKind === "worktree") {
      try {
        await runGit(["worktree", "remove", "--force", workspacePath], info.durablePath);
      } catch {
        await rmRetry(workspacePath);
      }
      try {
        await runGit(["worktree", "prune"], info.durablePath);
      } catch {
        // Best-effort cleanup: stale worktree metadata should not block eviction.
      }
    } else {
      await rmRetry(workspacePath);
    }
  }

  private sessionDir(sessionId: string): string {
    return resolve(this.sessionsRootDir, sessionId);
  }

  private sessionPath(sessionId: string): string {
    return resolve(this.sessionDir(sessionId), "workspace");
  }

  private touchedPath(sessionId: string): string {
    return join(this.sessionDir(sessionId), "touched.json");
  }

  private legacyTouchedPath(sessionId: string): string {
    return join(this.sessionPath(sessionId), ".gittrix-touched.json");
  }

  private workspaceMetadataPath(sessionId: string): string {
    return join(this.sessionDir(sessionId), "workspace.json");
  }

  private async loadTouched(sessionId: string): Promise<string[]> {
    try {
      const raw = await readFile(this.touchedPath(sessionId), "utf8");
      const data = JSON.parse(raw) as { files?: unknown };
      return Array.isArray(data.files) ? data.files.filter((v): v is string => typeof v === "string") : [];
    } catch {
      try {
        const raw = await readFile(this.legacyTouchedPath(sessionId), "utf8");
        const data = JSON.parse(raw) as { files?: unknown };
        return Array.isArray(data.files) ? data.files.filter((v): v is string => typeof v === "string") : [];
      } catch {
        return [];
      }
    }
  }

  private async saveTouched(sessionId: string, files: string[]): Promise<void> {
    await mkdir(this.sessionDir(sessionId), { recursive: true });
    await writeFile(this.touchedPath(sessionId), JSON.stringify({ files }, null, 2), "utf8");
  }

  private async markTouched(sessionId: string, path: string): Promise<void> {
    const touched = await this.loadTouched(sessionId);
    if (!touched.includes(path)) {
      touched.push(path);
      await this.saveTouched(sessionId, touched);
    }
  }

  private async addGitChangedFiles(sessionId: string, touched: Set<string>): Promise<void> {
    const workspacePath = this.sessionPath(sessionId);
    await this.addGitOutput(touched, await runGit(["diff", "--name-only", "HEAD", "--"], workspacePath));
    await this.addGitOutput(touched, await runGit(["diff", "--cached", "--name-only", "--"], workspacePath));
    await this.addGitOutput(touched, await runGit(["ls-files", "--others", "--exclude-standard"], workspacePath));
  }

  private async addGitOutput(touched: Set<string>, result: Awaited<ReturnType<typeof runGit>>): Promise<void> {
    for (const line of result.stdout.split("\n")) {
      const path = line.trim();
      if (path && !path.startsWith(".git/") && path !== ".gittrix-touched.json" && !path.startsWith(".glib/")) {
        touched.add(normalizePath(path));
      }
    }
  }

  private async saveWorkspaceMetadata(
    sessionId: string,
    metadata: { durablePath: string; workspacePath: string; workspaceKind: "worktree" | "clone" }
  ): Promise<void> {
    await writeFile(
      this.workspaceMetadataPath(sessionId),
      JSON.stringify(
        {
          durablePath: normalizePath(metadata.durablePath),
          workspacePath: normalizePath(metadata.workspacePath),
          workspaceKind: metadata.workspaceKind
        },
        null,
        2
      ),
      "utf8"
    );
  }

  private async loadWorkspaceMetadata(sessionId: string): Promise<null | { durablePath: string; workspaceKind: "worktree" | "clone" | "copy" | "remote" }> {
    try {
      const raw = await readFile(this.workspaceMetadataPath(sessionId), "utf8");
      const parsed = JSON.parse(raw) as { durablePath?: unknown; workspaceKind?: unknown };
      if (typeof parsed.durablePath !== "string") return null;
      const workspaceKind =
        parsed.workspaceKind === "worktree" || parsed.workspaceKind === "clone" || parsed.workspaceKind === "copy" || parsed.workspaceKind === "remote"
          ? parsed.workspaceKind
          : "copy";
      return { durablePath: parsed.durablePath, workspaceKind };
    } catch {
      return null;
    }
  }
}

async function listFilesRecursive(path: string, root: string): Promise<ListEntry[]> {
  const entries: ListEntry[] = [];
  let dirEntries: Array<{ name: string; isDirectory(): boolean }>;
  try {
    dirEntries = await readdir(path, { withFileTypes: true });
  } catch {
    return entries;
  }
  for (const entry of dirEntries) {
    if (entry.name === ".git" || entry.name === ".gittrix-touched.json") continue;
    const fullPath = join(path, entry.name);
    const relPath = normalizePath(relative(root, fullPath));
    if (entry.isDirectory()) {
      entries.push({ path: relPath, type: "dir" });
      entries.push(...(await listFilesRecursive(fullPath, root)));
    } else {
      entries.push({ path: relPath, type: "file" });
    }
  }
  return entries;
}

async function ensureShaAvailable(repoPath: string, sha: string): Promise<void> {
  try {
    await runGit(["cat-file", "-e", `${sha}^{commit}`], repoPath);
    return;
  } catch {
    // GitHub durable may resolve a remote commit the local repo has not fetched yet.
  }

  await runGit(["fetch", "--all", "--prune"], repoPath);
  await runGit(["cat-file", "-e", `${sha}^{commit}`], repoPath);
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}
