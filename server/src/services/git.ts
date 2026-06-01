import { simpleGit } from "simple-git";
import { getCurrentProjectId, getProjectById } from "./project-store";

const PROTECTED_PREFIX = ".glib/";

function activeRepo() {
  const current = getCurrentProjectId();
  if (!current) return null;
  const project = getProjectById(current);
  if (!project) return null;
  return project.path;
}

function getGit() {
  const repo = activeRepo();
  if (!repo) return null;
  return simpleGit(repo);
}

async function runGit(args: string[], cwd: string) {
  const proc = Bun.spawn({ cmd: ["git", ...args], cwd, stdout: "pipe", stderr: "pipe" });
  const code = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  if (code !== 0) throw new Error(stderr.trim() || `git ${args.join(" ")} failed`);
  return stdout.trim();
}

function normalizePath(file: string) {
  return file.replace(/\\/g, "/").replace(/^\.\//, "").trim();
}

function isProtectedPath(file: string) {
  const normalized = normalizePath(file);
  return normalized === ".glib" || normalized.startsWith(PROTECTED_PREFIX);
}

function sanitizeFiles(files: unknown): string[] {
  if (!Array.isArray(files)) return [];
  return files.map((file) => String(file || "").trim()).filter(Boolean);
}

async function porcelain(repo: string) {
  const out = await runGit(["status", "--porcelain=v1"], repo);
  return out.split("\n").map((line) => line.trimEnd()).filter(Boolean);
}

function parsePorcelainPath(line: string) {
  return line.slice(3).trim();
}

export async function gitStatus() {
  const git = getGit();
  const repo = activeRepo();
  if (!git || !repo) return null;
  const s = await git.status();
  const upstream = await runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], repo).catch(() => "");
  const remote = upstream ? upstream.split("/")[0] ?? "" : "";
  return {
    current: s.current,
    upstream,
    remote,
    canPush: Boolean(upstream),
    ahead: s.ahead,
    behind: s.behind,
    staged: s.staged,
    modified: s.modified,
    deleted: s.deleted,
    not_added: s.not_added,
    conflicted: s.conflicted
  };
}

export async function gitBranches() {
  const git = getGit();
  if (!git) return null;
  const b = await git.branchLocal();
  return {
    current: b.current,
    all: b.all
  };
}

export async function gitLog(limit = 50) {
  const git = getGit();
  if (!git) return null;
  const logs = await git.log({ maxCount: limit });
  return logs.all.map((item) => ({
    hash: item.hash,
    date: item.date,
    message: item.message,
    author_name: item.author_name,
    author_email: item.author_email
  }));
}

export async function gitStash(message?: string) {
  const repo = activeRepo();
  if (!repo) return null;
  const dirty = (await runGit(["status", "--porcelain=v1"], repo)).split("\n").filter((line) => line.trim() && !line.slice(3).trim().startsWith(".glib/"));
  if (!dirty.length) return { stashed: false, message: "working tree clean" };
  const before = await runGit(["stash", "list", "--format=%H"], repo).catch(() => "");
  const label = message?.trim() || `glib-code auto stash ${new Date().toISOString()}`;
  const output = await runGit(["stash", "push", "-u", "-m", label], repo);
  const after = await runGit(["stash", "list", "--format=%H"], repo).catch(() => "");
  const beforeTop = before.split("\n").filter(Boolean)[0] ?? "";
  const afterTop = after.split("\n").filter(Boolean)[0] ?? "";
  return { stashed: beforeTop !== afterTop, ref: beforeTop !== afterTop ? "stash@{0}" : "", message: output || label };
}

export async function gitPush() {
  const repo = activeRepo();
  if (!repo) return null;
  const branch = await runGit(["branch", "--show-current"], repo);
  const upstream = await runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], repo).catch(() => "");
  if (!branch) {
    const error = new Error("cannot push from detached HEAD");
    (error as Error & { code?: string }).code = "DETACHED_HEAD";
    throw error;
  }
  if (!upstream) {
    const error = new Error("current branch has no upstream remote");
    (error as Error & { code?: string }).code = "NO_UPSTREAM";
    throw error;
  }
  const [remote] = upstream.split("/");
  if (!remote) throw new Error("unable to resolve upstream remote");
  await runGit(["push", remote, branch], repo);
  const sha = await runGit(["rev-parse", "HEAD"], repo);
  return { ok: true, remote, branch, upstream, sha };
}

export async function gitStage(files?: unknown) {
  const repo = activeRepo();
  if (!repo) return null;
  const entries = sanitizeFiles(files);
  if (entries.some(isProtectedPath)) {
    const error = new Error("cannot stage protected .glib files");
    (error as Error & { code?: string; files?: string[] }).code = "PROTECTED_PATH";
    (error as Error & { files?: string[] }).files = entries.filter(isProtectedPath);
    throw error;
  }
  if (!entries.length) {
    const status = await porcelain(repo);
    const stageAll = status.map(parsePorcelainPath).filter((file) => file && !isProtectedPath(file));
    if (!stageAll.length) return { staged: [] as string[] };
    await runGit(["add", "--", ...stageAll], repo);
    return { staged: stageAll };
  }
  await runGit(["add", "--", ...entries], repo);
  return { staged: entries };
}

export async function gitUnstage(files: unknown) {
  const repo = activeRepo();
  if (!repo) return null;
  const entries = sanitizeFiles(files);
  if (!entries.length) {
    const error = new Error("files required");
    (error as Error & { code?: string }).code = "INVALID_INPUT";
    throw error;
  }
  try {
    await runGit(["restore", "--staged", "--", ...entries], repo);
  } catch {
    await runGit(["reset", "HEAD", "--", ...entries], repo);
  }
  return { unstaged: entries };
}

export async function gitDiscard(files: unknown) {
  const repo = activeRepo();
  if (!repo) return null;
  const entries = sanitizeFiles(files);
  if (!entries.length) {
    const error = new Error("files required");
    (error as Error & { code?: string }).code = "INVALID_INPUT";
    throw error;
  }
  if (entries.some(isProtectedPath)) {
    const error = new Error("cannot discard protected .glib files");
    (error as Error & { code?: string; files?: string[] }).code = "PROTECTED_PATH";
    (error as Error & { files?: string[] }).files = entries.filter(isProtectedPath);
    throw error;
  }
  const status = await porcelain(repo);
  const statusByFile = new Map<string, string>();
  for (const line of status) statusByFile.set(normalizePath(parsePorcelainPath(line)), line.slice(0, 2));
  const tracked = entries.filter((file) => {
    const flag = statusByFile.get(normalizePath(file));
    return !flag || !flag.includes("?");
  });
  const untracked = entries.filter((file) => statusByFile.get(normalizePath(file))?.includes("?") === true);
  for (const file of tracked) {
    try {
      await runGit(["restore", "--", file], repo);
    } catch {
      await runGit(["checkout", "--", file], repo).catch(() => undefined);
    }
  }
  if (untracked.length) await runGit(["clean", "-f", "--", ...untracked], repo);
  return { discarded: entries };
}

export async function gitCommit(message: string, files?: unknown) {
  const repo = activeRepo();
  if (!repo) return null;
  const msg = message.trim();
  if (!msg) {
    const error = new Error("commit message required");
    (error as Error & { code?: string }).code = "MESSAGE_REQUIRED";
    throw error;
  }
  const entries = sanitizeFiles(files);
  if (entries.some(isProtectedPath)) {
    const error = new Error("cannot commit protected .glib files");
    (error as Error & { code?: string; files?: string[] }).code = "PROTECTED_PATH";
    (error as Error & { files?: string[] }).files = entries.filter(isProtectedPath);
    throw error;
  }
  if (entries.length) await runGit(["add", "--", ...entries], repo);
  const staged = await runGit(["diff", "--cached", "--name-only"], repo);
  const stagedFiles = staged.split("\n").map((line) => line.trim()).filter((line) => line && !isProtectedPath(line));
  if (!stagedFiles.length) {
    const error = new Error("nothing staged to commit");
    (error as Error & { code?: string }).code = "NOTHING_TO_COMMIT";
    throw error;
  }
  await runGit(["commit", "-m", msg], repo);
  const sha = await runGit(["rev-parse", "HEAD"], repo);
  const branch = await runGit(["branch", "--show-current"], repo);
  return { sha, branch };
}

export async function gitPull() {
  const repo = activeRepo();
  if (!repo) return null;
  const branch = await runGit(["branch", "--show-current"], repo);
  if (!branch) {
    const error = new Error("cannot pull from detached HEAD");
    (error as Error & { code?: string }).code = "DETACHED_HEAD";
    throw error;
  }
  const upstream = await runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], repo).catch(() => "");
  if (!upstream) {
    const error = new Error("current branch has no upstream remote");
    (error as Error & { code?: string }).code = "NO_UPSTREAM";
    throw error;
  }
  try {
    await runGit(["pull"], repo);
    const sha = await runGit(["rev-parse", "HEAD"], repo);
    return { ok: true, upstream, branch, sha };
  } catch (error) {
    const conflicted = (await runGit(["diff", "--name-only", "--diff-filter=U"], repo).catch(() => ""))
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (conflicted.length) {
      return { ok: false, code: "PULL_CONFLICT", files: conflicted };
    }
    throw error;
  }
}

export async function gitCheckout(ref: string, create = false) {
  const repo = activeRepo();
  if (!repo) return null;
  const target = ref.trim();
  if (!target) {
    const error = new Error("ref required");
    (error as Error & { code?: string }).code = "INVALID_INPUT";
    throw error;
  }
  const dirty = (await porcelain(repo)).map(parsePorcelainPath).filter((file) => file && !isProtectedPath(file));
  if (dirty.length) {
    const error = new Error("working tree is dirty");
    (error as Error & { code?: string; files?: string[] }).code = "DIRTY_TREE";
    (error as Error & { files?: string[] }).files = [...new Set(dirty)];
    throw error;
  }
  await runGit(create ? ["checkout", "-b", target] : ["checkout", target], repo);
  const branch = await runGit(["branch", "--show-current"], repo);
  return { ok: true, branch, ref: target };
}

export async function gitCreateBranch(name: string, from?: string, checkout = false) {
  const repo = activeRepo();
  if (!repo) return null;
  const next = name.trim();
  if (!next) {
    const error = new Error("branch name required");
    (error as Error & { code?: string }).code = "INVALID_INPUT";
    throw error;
  }
  if (checkout) {
    await runGit(from?.trim() ? ["checkout", "-b", next, from.trim()] : ["checkout", "-b", next], repo);
  } else {
    await runGit(from?.trim() ? ["branch", next, from.trim()] : ["branch", next], repo);
  }
  return { ok: true, name: next, from: from?.trim() || "", checkedOut: checkout };
}

export async function gitCommitDetail(sha: string) {
  const repo = activeRepo();
  if (!repo) return null;
  const rev = sha.trim();
  if (!rev) return null;
  const info = await runGit(["show", "-s", "--format=%H%n%an%n%ae%n%aI%n%s%n%b", rev], repo);
  const [fullSha = "", authorName = "", authorEmail = "", date = "", subject = "", ...bodyLines] = info.split("\n");
  const body = bodyLines.join("\n").trim();
  const filesRaw = await runGit(["show", "--name-status", "--format=", rev], repo);
  const files = filesRaw.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [status, ...rest] = line.split("\t");
    return { path: rest.join("\t"), status };
  });
  return { sha: fullSha, authorName, authorEmail, date, subject, body, files };
}
