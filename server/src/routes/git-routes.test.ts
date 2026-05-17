import { beforeEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gitRoutes } from "./git";
import { registerProject, resetProjectStoreForTests, setCurrentProject } from "../services/project-store";

let root = "";
let repo = "";
let app: Hono;

async function runGit(args: string[], cwd: string) {
  const proc = Bun.spawn({ cmd: ["git", ...args], cwd, stdout: "pipe", stderr: "pipe" });
  const code = await proc.exited;
  if (code !== 0) throw new Error(await new Response(proc.stderr).text());
}

async function gitOut(args: string[], cwd: string) {
  const proc = Bun.spawn({ cmd: ["git", ...args], cwd, stdout: "pipe", stderr: "pipe" });
  const code = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  if (code !== 0) throw new Error(await new Response(proc.stderr).text());
  return stdout.trim();
}

async function initRepo() {
  await runGit(["init", "-b", "main"], repo);
  await runGit(["config", "user.name", "Test User"], repo);
  await runGit(["config", "user.email", "test@example.com"], repo);
  await writeFile(join(repo, "README.md"), "initial\n", "utf8");
  await runGit(["add", "README.md"], repo);
  await runGit(["commit", "-m", "initial"], repo);
}

beforeEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = await mkdtemp(join(tmpdir(), "glib-git-routes-"));
  process.env.GLIB_CONFIG_DIR = join(root, "config");
  process.env.APPDATA = root;
  repo = join(root, "repo");
  await mkdir(repo, { recursive: true });
  await initRepo();
  resetProjectStoreForTests();
  registerProject({ id: "project", name: "repo", path: repo, branch: "main", isGitRepo: true });
  setCurrentProject("project");
  app = new Hono();
  app.route("/api/git", gitRoutes);
});

describe("git routes", () => {
  test("stash creates a stash for dirty local repo", async () => {
    await writeFile(join(repo, "README.md"), "dirty\n", "utf8");
    const res = await app.request("/api/git/stash", {
      method: "POST",
      body: JSON.stringify({ message: "test stash" }),
      headers: { "content-type": "application/json" }
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stashed).toBe(true);
    expect(await gitOut(["status", "--porcelain=v1"], repo)).toBe("");
  });

  test("push blocks when current branch has no upstream", async () => {
    const res = await app.request("/api/git/push", { method: "POST" });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NO_UPSTREAM");
  });
});
