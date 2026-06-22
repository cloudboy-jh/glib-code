import { beforeEach, afterEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fsRoutes } from "./fs";
import { registerProject, resetProjectStoreForTests, setCurrentProject } from "../services/project-store";

let root = "";
let repo = "";
let app: Hono;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "glib-fs-routes-"));
  process.env.GLIB_CONFIG_DIR = join(root, "config");
  process.env.APPDATA = root;
  repo = join(root, "repo");
  await mkdir(repo, { recursive: true });
  resetProjectStoreForTests();
  registerProject({ id: "project", name: "repo", path: repo, branch: "main", isGitRepo: true });
  setCurrentProject("project");
  app = new Hono();
  app.route("/api/fs", fsRoutes);
});

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

describe("GET /api/fs/paths", () => {
  test("returns 404 when no project is open", async () => {
    resetProjectStoreForTests();
    const res = await app.request("/api/fs/paths");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test("returns empty paths for empty repo", async () => {
    const res = await app.request("/api/fs/paths");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.paths).toEqual([]);
  });

  test("flattens nested directory structure", async () => {
    await mkdir(join(repo, "src", "components"), { recursive: true });
    await mkdir(join(repo, "src", "utils"), { recursive: true });
    await writeFile(join(repo, "README.md"), "# test\n", "utf8");
    await writeFile(join(repo, "src", "index.ts"), "export {};\n", "utf8");
    await writeFile(join(repo, "src", "components", "Button.vue"), "<template />\n", "utf8");
    await writeFile(join(repo, "src", "utils", "helpers.ts"), "export {};\n", "utf8");

    const res = await app.request("/api/fs/paths");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const paths: string[] = body.paths;
    expect(paths).toContain("README.md");
    expect(paths).toContain("src/");
    expect(paths).toContain("src/index.ts");
    expect(paths).toContain("src/components/");
    expect(paths).toContain("src/components/Button.vue");
    expect(paths).toContain("src/utils/");
    expect(paths).toContain("src/utils/helpers.ts");
  });

  test("directories get trailing slash", async () => {
    await mkdir(join(repo, "lib"), { recursive: true });
    await writeFile(join(repo, "lib", "mod.ts"), "", "utf8");

    const res = await app.request("/api/fs/paths");
    const body = await res.json();
    const paths: string[] = body.paths;

    expect(paths).toContain("lib/");
    expect(paths).toContain("lib/mod.ts");
    expect(paths.filter((p) => p === "lib")).toHaveLength(0);
  });

  test("skips .git and .glib directories", async () => {
    await mkdir(join(repo, ".git"), { recursive: true });
    await mkdir(join(repo, ".glib"), { recursive: true });
    await mkdir(join(repo, "src"), { recursive: true });
    await writeFile(join(repo, ".git", "config"), "", "utf8");
    await writeFile(join(repo, ".glib", "sessions.json"), "{}", "utf8");
    await writeFile(join(repo, "src", "app.ts"), "", "utf8");

    const res = await app.request("/api/fs/paths");
    const body = await res.json();
    const paths: string[] = body.paths;

    expect(paths).toContain("src/");
    expect(paths).toContain("src/app.ts");
    expect(paths.some((p) => p.startsWith(".git"))).toBe(false);
    expect(paths.some((p) => p.startsWith(".glib"))).toBe(false);
  });
});
