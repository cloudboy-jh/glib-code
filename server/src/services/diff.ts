import { simpleGit } from "simple-git";
import { getCurrentProjectId, getProjectById } from "./state";

function repoPath() {
  const id = getCurrentProjectId();
  if (!id) return null;
  return getProjectById(id)?.path ?? null;
}

async function gitRaw(args: string[]) {
  const repo = repoPath();
  if (!repo) return null;
  const proc = Bun.spawn({ cmd: ["git", ...args], cwd: repo, stdout: "pipe", stderr: "pipe" });
  const code = await proc.exited;
  const out = await new Response(proc.stdout).text();
  return code === 0 ? out : null;
}

export async function diffItems(source: string, limit = 50) {
  if (source === "uncommitted") {
    return [{ id: "working-tree", title: "Working tree", ref: "working-tree" }];
  }

  if (source === "commits") {
    const repo = repoPath();
    if (!repo) return null;
    const git = simpleGit(repo);
    const log = await git.log({ maxCount: limit });
    return log.all.map((c) => ({
      id: c.hash,
      title: c.message,
      ref: c.hash,
      author: c.author_name,
      date: c.date
    }));
  }

  return [];
}

export async function diffFiles(source: string, ref?: string) {
  if (source === "uncommitted") {
    const out = await gitRaw(["status", "--porcelain"]);
    if (out == null) return null;
    return out
      .split("\n")
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .map((line) => {
        const status = line.slice(0, 2).trim();
        const file = line.slice(3).trim();
        return { file, status };
      });
  }

  if (source === "commits" && ref) {
    const out = await gitRaw(["show", "--name-status", "--pretty=format:", ref]);
    if (out == null) return null;
    return out
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [status, ...rest] = line.split("\t");
        return { file: rest.join("\t"), status };
      });
  }

  return [];
}

export async function diffHunks(source: string, file: string, ref?: string) {
  const args = source === "commits" && ref
    ? ["show", ref, "--", file]
    : ["diff", "--", file];

  const out = await gitRaw(args);
  if (out == null) return null;
  const lines = out.split("\n");

  const hunks: Array<{ header: string; startLine: number }> = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith("@@")) {
      hunks.push({ header: lines[i], startLine: i + 1 });
    }
  }

  return hunks;
}

export async function packDiff(source: string, ref?: string, file?: string) {
  let args: string[];
  if (source === "commits" && ref) {
    args = file ? ["show", ref, "--", file] : ["show", ref];
  } else {
    args = file ? ["diff", "--", file] : ["diff"];
  }
  const diff = await gitRaw(args);
  if (diff == null) return null;
  return {
    diff,
    stats: {
      files: (diff.match(/^diff --git/gm) || []).length,
      hunks: (diff.match(/^@@/gm) || []).length,
      additions: (diff.match(/^\+[^+]/gm) || []).length,
      deletions: (diff.match(/^-[^-]/gm) || []).length
    }
  };
}
