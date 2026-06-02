import { beforeEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projectsRoutes } from "./projects";
import { resetProjectStoreForTests } from "../services/project-store";

let root = "";
let sourceRepo = "";
let destination = "";
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
  root = await mkdtemp(join(tmpdir(), "glib-projects-routes-"));
  process.env.GLIB_CONFIG_DIR = join(root, "config");
  process.env.APPDATA = root;
  sourceRepo = join(root, "source");
  destination = join(root, "dest");
  await mkdir(sourceRepo, { recursive: true });
  await mkdir(destination, { recursive: true });
  await initRepo(sourceRepo);
  resetProjectStoreForTests();
  app = new Hono();
  app.route("/api/projects", projectsRoutes);
});

describe("projects clone route", () => {
  test("clone rejects invalid url", async () => {
    const res = await app.request("/api/projects/clone", {
      method: "POST",
      body: JSON.stringify({ url: "not-a-repo", destination }),
      headers: { "content-type": "application/json" }
    });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_URL");
  });

  test("clone creates destination path when missing", async () => {
    const missing = join(root, "missing-destination");
    const res = await app.request("/api/projects/clone", {
      method: "POST",
      body: JSON.stringify({ url: sourceRepo, destination: missing }),
      headers: { "content-type": "application/json" }
    });
    expect(res.status).toBe(201);
    expect((await res.json()).name).toBe("source");
  });

  test("clone rejects existing non-empty target", async () => {
    const target = join(destination, "source");
    await mkdir(target, { recursive: true });
    await writeFile(join(target, "existing.txt"), "x\n", "utf8");
    const res = await app.request("/api/projects/clone", {
      method: "POST",
      body: JSON.stringify({ url: sourceRepo, destination }),
      headers: { "content-type": "application/json" }
    });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("TARGET_EXISTS");
  });

  test("clone succeeds for local repo path", async () => {
    const res = await app.request("/api/projects/clone", {
      method: "POST",
      body: JSON.stringify({ url: sourceRepo, destination }),
      headers: { "content-type": "application/json" }
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { name: string; path: string; branch: string; isGitRepo: boolean };
    expect(body.name).toBe("source");
    expect(body.path.replace(/\\/g, "/")).toContain("/dest/source");
    expect(body.branch).toBe("main");
    expect(body.isGitRepo).toBe(true);
  });
});
