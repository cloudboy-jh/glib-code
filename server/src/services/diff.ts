import { simpleGit } from "simple-git";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fallbackProjectPath } from "./project-store";

function repoPath(projectPath?: string) {
  if (projectPath && projectPath.trim()) return projectPath.trim();
  return fallbackProjectPath();
}

async function gitRaw(args: string[], projectPath?: string) {
  const repo = repoPath(projectPath);
  if (!repo) return null;
  const proc = Bun.spawn({ cmd: ["git", ...args], cwd: repo, stdout: "pipe", stderr: "pipe" });
  const code = await proc.exited;
  const out = await new Response(proc.stdout).text();
  return code === 0 ? out : null;
}

async function isUntracked(file: string, projectPath?: string) {
  const out = await gitRaw(["status", "--porcelain", "--", file], projectPath);
  return out?.split("\n").some((line) => line.startsWith("?? ")) ?? false;
}

async function untrackedFileDiff(file: string, projectPath?: string) {
  const repo = repoPath(projectPath);
  if (!repo) return null;
  try {
    const content = await readFile(join(repo, file), "utf8");
    const lines = content.split("\n");
    const body = lines.map((line) => `+${line}`).join("\n");
    return `diff --git a/${file} b/${file}\nnew file mode 100644\nindex 0000000..0000000\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n${body}`;
  } catch {
    return null;
  }
}

export async function diffItems(source: string, limit = 50, projectPath?: string) {
  if (source === "uncommitted") {
    return [{ id: "working-tree", title: "Working tree", ref: "working-tree" }];
  }

  if (source === "commits") {
    const repo = repoPath(projectPath);
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

export async function diffFiles(source: string, ref?: string, projectPath?: string) {
  if (source === "uncommitted") {
    const out = await gitRaw(["status", "--porcelain"], projectPath);
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
    const out = await gitRaw(["show", "--name-status", "--pretty=format:", ref], projectPath);
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

export async function diffHunks(source: string, file: string, ref?: string, projectPath?: string) {
  const args = source === "commits" && ref
    ? ["show", ref, "--", file]
    : ["diff", "HEAD", "--", file];

  const out = await gitRaw(args, projectPath);
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

export async function packDiff(source: string, ref?: string, file?: string, projectPath?: string) {
  let args: string[];
  if (source === "commits" && ref) {
    args = file ? ["show", ref, "--", file] : ["show", ref];
  } else {
    if (file && await isUntracked(file, projectPath)) {
      const diff = await untrackedFileDiff(file, projectPath);
      if (diff == null) return null;
      return {
        diff,
        stats: {
          files: 1,
          hunks: 1,
          additions: (diff.match(/^\+[^+]/gm) || []).length,
          deletions: 0
        }
      };
    }
    args = file ? ["diff", "HEAD", "--", file] : ["diff", "HEAD"];
  }
  const diff = await gitRaw(args, projectPath);
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
