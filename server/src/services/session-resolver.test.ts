import { beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSession, deleteSession, getSessionById } from "./session-store";
import { registerProject, resetProjectStoreForTests, setCurrentProject } from "./project-store";
import { resolveAgentCwd, resolveSession } from "./session-resolver";

let root = "";
let repoA = "";
let repoB = "";

beforeEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = await mkdtemp(join(tmpdir(), "glib-session-resolver-"));
  process.env.APPDATA = root;
  repoA = join(root, "repo-a");
  repoB = join(root, "repo-b");
  await mkdir(repoA, { recursive: true });
  await mkdir(repoB, { recursive: true });
  resetProjectStoreForTests();
  registerProject({ id: "project-a", name: "repo-a", path: repoA, branch: "main", isGitRepo: true });
  registerProject({ id: "project-b", name: "repo-b", path: repoB, branch: "main", isGitRepo: true });
  setCurrentProject("project-b");
});

describe("session resolver", () => {
  test("resolves by session index before current project fallback", async () => {
    const session = await createSession({ projectId: "project-a", projectPath: repoA, title: "A", model: "m", provider: "p" });
    const resolved = await resolveSession(null, session.id);
    expect(resolved.existing?.meta.id).toBe(session.id);
    expect(resolved.projectPath?.replace(/\\/g, "/")).toBe(repoA.replace(/\\/g, "/"));
  });

  test("resolves by explicit projectPath when index is missing", async () => {
    const session = await createSession({ projectId: "project-a", projectPath: repoA, title: "A", model: "m", provider: "p" });
    await deleteSession(repoA, "non-existent");
    const resolved = await resolveSession(repoA, session.id);
    expect(resolved.existing?.meta.id).toBe(session.id);
  });

  test("cleans stale index and returns one clean miss", async () => {
    const session = await createSession({ projectId: "project-a", projectPath: repoA, title: "A", model: "m", provider: "p" });
    await deleteSession(repoA, session.id);
    expect(await getSessionById(session.id)).toBeNull();
    const resolved = await resolveSession(repoA, session.id);
    expect(resolved.existing).toBeNull();
    expect(resolved.projectPath?.replace(/\\/g, "/")).toBe(repoA.replace(/\\/g, "/"));
  });

  test("uses git-backed ephemeral cwd only when metadata and .git agree", async () => {
    const eph = join(root, "eph");
    await mkdir(join(eph, ".git"), { recursive: true });
    expect(resolveAgentCwd(repoA, eph, true).replace(/\\/g, "/")).toBe(eph.replace(/\\/g, "/"));
    expect(resolveAgentCwd(repoA, eph, false).replace(/\\/g, "/")).toBe(repoA.replace(/\\/g, "/"));
    expect(resolveAgentCwd(repoA, join(root, "missing"), true).replace(/\\/g, "/")).toBe(repoA.replace(/\\/g, "/"));
  });
});
