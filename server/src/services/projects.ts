import { existsSync } from "node:fs";
import { mkdir, writeFile, rm, readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { ensureRepoGlibIgnore } from "../lib/paths";

// Expand a leading "~" to the user's home dir before path.resolve, which does
// not understand tilde and would otherwise produce "<cwd>/~/...".
function expandHome(input: string): string {
  const trimmed = input.trim();
  if (trimmed === "~") return homedir();
  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) return join(homedir(), trimmed.slice(2));
  return trimmed;
}

export type RecentPathStatus = "ok" | "missing_path" | "missing_git";

export type OpenProjectResult =
  | { ok: true; project: { id: string; name: string; path: string; branch: string; isGitRepo: true } }
  | { ok: false; needsInit: true };

function idForPath(path: string) {
  return createHash("sha1").update(resolve(path)).digest("hex").slice(0, 12);
}

async function run(cmd: string[], cwd?: string) {
  const proc = Bun.spawn({ cmd, cwd, stdout: "pipe", stderr: "pipe" });
  const code = await proc.exited;
  const out = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  return { code, out: out.trim(), err: err.trim() };
}

function hasGit(path: string) {
  return existsSync(join(path, ".git"));
}

export function inspectRecentPath(path: string): RecentPathStatus {
  const full = resolve(path);
  if (!existsSync(full)) return "missing_path";
  if (!hasGit(full)) return "missing_git";
  return "ok";
}

async function currentBranch(path: string) {
  const result = await run(["git", "rev-parse", "--abbrev-ref", "HEAD"], path);
  return result.code === 0 && result.out ? result.out : "main";
}

export async function openProject(path: string): Promise<OpenProjectResult> {
  // Reject Windows drive-letter paths on POSIX before resolve() mangles them.
  if (process.platform !== "win32" && /^[a-zA-Z]:[\\/]/.test(path.trim())) {
    return { ok: false, needsInit: true };
  }
  const full = resolve(path);
  if (!hasGit(full)) return { ok: false, needsInit: true };
  const branch = await currentBranch(full);
  await ensureRepoGlibIgnore(full);
  return {
    ok: true,
    project: {
      id: idForPath(full),
      name: basename(full),
      path: full,
      branch,
      isGitRepo: true
    }
  };
}

export async function initProject(path: string) {
  const full = resolve(path);
  await run(["git", "init"], full);
  await ensureRepoGlibIgnore(full);
  return openProject(full);
}

export async function createProject(parent: string, name: string) {
  const full = resolve(join(parent, name));
  await mkdir(full, { recursive: false });
  await run(["git", "init"], full);
  await writeFile(join(full, ".gitignore"), ".glib/\nnode_modules/\n.env*\ndist/\nbuild/\n", "utf8");
  await ensureRepoGlibIgnore(full);
  return openProject(full);
}

function repoNameFromUrl(url: string) {
  const trimmed = url.trim();
  if (/^file:\/\//i.test(trimmed)) {
    try {
      const filePath = new URL(trimmed).pathname;
      const parsed = basename(filePath.replace(/\\/g, "/"));
      return parsed.replace(/\.git$/i, "") || "repo";
    } catch {
      // fallback below
    }
  }
  if (/^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.includes("\\")) {
    return basename(trimmed).replace(/\.git$/i, "") || "repo";
  }
  const last = trimmed.replace(/\/$/, "").split("/").filter(Boolean).pop() ?? "repo";
  return last.replace(/\.git$/i, "") || "repo";
}

function isCloneSource(remote: string) {
  if (/^https?:\/\//i.test(remote)) return true;
  if (/^git@/i.test(remote)) return true;
  if (/^ssh:\/\//i.test(remote)) return true;
  if (/^file:\/\//i.test(remote)) return true;
  return existsSync(resolve(remote));
}

export async function cloneProject(url: string, destination: string) {
  const remote = url.trim();
  if (!isCloneSource(remote)) {
    const error = new Error("invalid clone url");
    (error as Error & { code?: string }).code = "INVALID_URL";
    throw error;
  }

  // Reject Windows drive-letter destinations on POSIX. resolve() treats them as
  // relative and silently produces garbage like "/server/cwd/C:/repos/foo".
  const destTrimmed = expandHome(destination);
  if (process.platform !== "win32" && /^[a-zA-Z]:[\\/]/.test(destTrimmed)) {
    const error = new Error(`"${destTrimmed}" is a Windows path; provide an absolute path for this machine`);
    (error as Error & { code?: string }).code = "INVALID_DESTINATION";
    throw error;
  }

  const parent = resolve(destTrimmed);
  if (!parent) {
    const error = new Error("destination path required");
    (error as Error & { code?: string }).code = "INVALID_INPUT";
    throw error;
  }
  if (!existsSync(parent)) {
    try {
      await mkdir(parent, { recursive: true });
    } catch {
      const error = new Error("destination path could not be created");
      (error as Error & { code?: string }).code = "DESTINATION_CREATE_FAILED";
      throw error;
    }
  }

  const target = resolve(join(parent, repoNameFromUrl(remote)));
  if (existsSync(target)) {
    const files = await readdir(target).catch(() => []);
    if (files.length > 0) {
      const error = new Error("clone target already exists");
      (error as Error & { code?: string }).code = "TARGET_EXISTS";
      throw error;
    }
  }

  const cloned = await run(["git", "clone", remote, target]);
  if (cloned.code !== 0) {
    const error = new Error(cloned.err || "clone failed");
    (error as Error & { code?: string }).code = "CLONE_FAILED";
    throw error;
  }

  const opened = await openProject(target);
  if (!opened.ok) {
    const error = new Error("cloned repo could not be opened");
    (error as Error & { code?: string }).code = "OPEN_FAILED";
    throw error;
  }
  return opened.project;
}

export async function forgetProject(path: string) {
  const glibDir = join(resolve(path), ".glib");
  if (existsSync(glibDir)) {
    await rm(glibDir, { recursive: true, force: true });
  }
}

export function projectIdFromPath(path: string) {
  return idForPath(path);
}

export async function projectCandidates(query = "") {
  const q = query.trim();
  const rows: Array<{ name: string; path: string; source: "zoxide" }> = [];
  const args = q ? ["query", "-l", q] : ["query", "-l"];
  const result = await run(["zoxide", ...args]).catch(() => null);
  if (!result || result.code !== 0) return rows;

  const seen = new Set<string>();
  for (const line of result.out.split("\n")) {
    const path = line.trim();
    if (!path) continue;
    const full = resolve(path);
    if (seen.has(full) || !existsSync(full)) continue;
    seen.add(full);
    rows.push({ name: basename(full), path: full, source: "zoxide" });
    if (rows.length >= 20) break;
  }
  return rows;
}
