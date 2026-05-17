import { simpleGit } from "simple-git";
import { getCurrentProjectId, getProjectById } from "./project-store";

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
