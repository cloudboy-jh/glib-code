import { beforeEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
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

beforeEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = await mkdtemp(join(tmpdir(), "glib-session-routes-"));
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
});
