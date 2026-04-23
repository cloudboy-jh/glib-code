import { existsSync } from "node:fs";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { ensureRepoGlibIgnore } from "../lib/paths";

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

async function currentBranch(path: string) {
  const result = await run(["git", "rev-parse", "--abbrev-ref", "HEAD"], path);
  return result.code === 0 && result.out ? result.out : "main";
}

export async function openProject(path: string): Promise<OpenProjectResult> {
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

export async function forgetProject(path: string) {
  const glibDir = join(resolve(path), ".glib");
  if (existsSync(glibDir)) {
    await rm(glibDir, { recursive: true, force: true });
  }
}

export function projectIdFromPath(path: string) {
  return idForPath(path);
}
