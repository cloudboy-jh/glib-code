import { beforeEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agentRoutes } from "./agent";
import { sessionsRoutes } from "./sessions";
import { createSession } from "../services/session-store";
import { registerProject, resetProjectStoreForTests, setCurrentProject } from "../services/project-store";

let root = "";
let repoA = "";
let repoB = "";
let app: Hono;

async function runGit(args: string[], cwd: string) {
  const proc = Bun.spawn({ cmd: ["git", ...args], cwd, stdout: "pipe", stderr: "pipe" });
  const code = await proc.exited;
  if (code !== 0) throw new Error(await new Response(proc.stderr).text());
}

async function initRepo(path: string) {
  await runGit(["init", "-b", "main"], path);
  await runGit(["config", "user.name", "Test User"], path);
  await runGit(["config", "user.email", "test@example.com"], path);
  await writeFile(join(path, "README.md"), "initial\n", "utf8");
  await runGit(["add", "README.md"], path);
  await runGit(["commit", "-m", "initial"], path);
}

beforeEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = await mkdtemp(join(tmpdir(), "glib-session-routes-"));
  process.env.GLIB_CONFIG_DIR = join(root, "config");
  process.env.APPDATA = root;
  repoA = join(root, "repo-a");
  repoB = join(root, "repo-b");
  await mkdir(repoA, { recursive: true });
  await mkdir(repoB, { recursive: true });
  resetProjectStoreForTests();
  registerProject({ id: "project-a", name: "repo-a", path: repoA, branch: "main", isGitRepo: true });
  registerProject({ id: "project-b", name: "repo-b", path: repoB, branch: "main", isGitRepo: true });
  setCurrentProject("project-b");
  app = new Hono();
  app.route("/api/agent", agentRoutes);
  app.route("/api/sessions", sessionsRoutes);
});

async function makeSession() {
  return createSession({ projectId: "project-a", projectPath: repoA, title: "A", model: "m", provider: "p" });
}

async function makeGitTrixSession() {
  return createSession({
    projectId: "project-a",
    projectPath: repoA,
    title: "A",
    model: "m",
    provider: "p",
    gittrixSessionId: "gittrix-test-session",
    ephemeralPath: join(root, "missing-workspace"),
    baselineSha: "baseline",
    isGitBacked: true,
    workspaceKind: "worktree"
  });
}

describe("session routes projectPath resolution", () => {
  test("GET /api/sessions/:id resolves explicit projectPath instead of current project", async () => {
    const session = await makeSession();
    const res = await app.request(`/api/sessions/${session.id}?projectPath=${encodeURIComponent(repoA)}`);
    expect(res.status).toBe(200);
    expect((await res.json()).meta.id).toBe(session.id);
  });

  test("PATCH /api/sessions/:id resolves explicit projectPath", async () => {
    const session = await makeSession();
    const res = await app.request(`/api/sessions/${session.id}?projectPath=${encodeURIComponent(repoA)}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "patched" }),
      headers: { "content-type": "application/json" }
    });
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe("patched");
  });

  test("send validates resolved session before provider runtime", async () => {
    const session = await makeSession();
    const res = await app.request(`/api/agent/sessions/${session.id}/send`, {
      method: "POST",
      body: JSON.stringify({ prompt: "", projectPath: repoA }),
      headers: { "content-type": "application/json" }
    });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain("prompt required");
  });

  test("abort route resolves explicit projectPath and returns no active turn", async () => {
    const session = await makeSession();
    const res = await app.request(`/api/agent/sessions/${session.id}/turn?projectPath=${encodeURIComponent(repoA)}`, { method: "DELETE" });
    expect(res.status).toBe(404);
    expect((await res.json()).message).toContain("no active turn");
  });

  test("diff/promote/evict routes resolve session before requiring gittrix mapping", async () => {
    const session = await makeSession();
    for (const [path, init] of [
      [`/api/sessions/${session.id}/diff?projectPath=${encodeURIComponent(repoA)}`, undefined],
      [`/api/sessions/${session.id}/promote?projectPath=${encodeURIComponent(repoA)}`, { method: "POST", body: JSON.stringify({ selector: { mode: "all" } }), headers: { "content-type": "application/json" } }],
      [`/api/sessions/${session.id}/evict?projectPath=${encodeURIComponent(repoA)}`, { method: "POST" }]
    ] as const) {
      const res = await app.request(path, init);
      expect(res.status).toBe(400);
      expect((await res.json()).message).toContain("gittrix mapping");
    }
  });

  test("diff route returns structured errors when GitTrix diff fails", async () => {
    const session = await makeGitTrixSession();
    const res = await app.request(`/api/sessions/${session.id}/diff?projectPath=${encodeURIComponent(repoA)}`);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("DIFF_FAILED");
    expect(body.retryable).toBe(true);
  });

  test("promote route returns structured errors when GitTrix promote fails", async () => {
    const session = await makeGitTrixSession();
    const res = await app.request(`/api/sessions/${session.id}/promote?projectPath=${encodeURIComponent(repoA)}`, {
      method: "POST",
      body: JSON.stringify({ selector: { mode: "all" } }),
      headers: { "content-type": "application/json" }
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("PROMOTE_FAILED");
    expect(body.retryable).toBe(true);
  });

  test("promote route blocks all-file local commit when durable repo is dirty", async () => {
    await initRepo(repoA);
    await writeFile(join(repoA, "README.md"), "dirty\n", "utf8");
    const session = await makeGitTrixSession();
    const res = await app.request(`/api/sessions/${session.id}/promote?projectPath=${encodeURIComponent(repoA)}`, {
      method: "POST",
      body: JSON.stringify({ selector: { mode: "all" } }),
      headers: { "content-type": "application/json" }
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("DURABLE_REPO_DIRTY");
    expect(body.files).toEqual(["README.md"]);
  });

  test("promote route allows file-scoped local commit when dirty durable files do not overlap", async () => {
    await initRepo(repoA);
    await writeFile(join(repoA, "README.md"), "dirty\n", "utf8");
    const session = await makeGitTrixSession();
    const res = await app.request(`/api/sessions/${session.id}/promote?projectPath=${encodeURIComponent(repoA)}`, {
      method: "POST",
      body: JSON.stringify({ selector: { mode: "files", files: ["src/new-file.ts"] } }),
      headers: { "content-type": "application/json" }
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("PROMOTE_FAILED");
  });
});
