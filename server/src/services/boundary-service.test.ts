import { beforeEach, afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { diffStats, filesFromPatch, durableWorkingTreeChanges } from "./boundary-service";

async function git(args: string[], cwd: string) {
  const proc = Bun.spawn({ cmd: ["git", ...args], cwd, stdout: "pipe", stderr: "pipe" });
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`git ${args.join(" ")} failed: ${err}`);
  }
}

describe("diffStats", () => {
  test("counts additions and deletions, ignoring hunk headers", () => {
    const patch = [
      "diff --git a/foo.txt b/foo.txt",
      "--- a/foo.txt",
      "+++ b/foo.txt",
      "@@ -1,2 +1,3 @@",
      " context",
      "-removed line",
      "+added line one",
      "+added line two",
    ].join("\n");
    expect(diffStats(patch)).toEqual({ additions: 2, deletions: 1 });
  });

  test("does not count +++/--- file headers", () => {
    const patch = "--- a/x\n+++ b/x\n@@ -0,0 +1 @@\n+only\n";
    expect(diffStats(patch)).toEqual({ additions: 1, deletions: 0 });
  });

  test("empty patch yields zeros", () => {
    expect(diffStats("")).toEqual({ additions: 0, deletions: 0 });
  });
});

describe("filesFromPatch", () => {
  test("extracts file paths from diff headers", () => {
    const patch = [
      "diff --git a/src/a.ts b/src/a.ts",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -1 +1 @@",
      "-old",
      "+new",
      "diff --git a/b.md b/b.md",
      "--- a/b.md",
      "+++ b/b.md",
    ].join("\n");
    expect(filesFromPatch(patch).sort()).toEqual(["b.md", "src/a.ts"]);
  });

  test("ignores /dev/null for deletions", () => {
    const patch = "diff --git a/gone.txt b/gone.txt\n--- a/gone.txt\n+++ /dev/null\n";
    expect(filesFromPatch(patch)).toEqual(["gone.txt"]);
  });

  // gittrix computeDiff uses jsdiff createPatch, which emits `Index:` headers and
  // `+++ <file>\tb` (tab-suffixed) instead of git's `+++ b/<file>`. The parser
  // must handle this or the ephemeral zone shows "clean" despite real changes.
  test("extracts file paths from jsdiff createPatch headers", () => {
    const patch = [
      "Index: README.md",
      "===================================================================",
      "--- README.md\ta",
      "+++ README.md\tb",
      "@@ -1,8 +1,10 @@",
      " # Title",
      "+## Getting Started",
      "+",
    ].join("\n");
    expect(filesFromPatch(patch)).toEqual(["README.md"]);
  });
});

describe("durableWorkingTreeChanges", () => {
  let repo = "";

  beforeEach(async () => {
    repo = await mkdtemp(join(tmpdir(), "glib-boundary-"));
    await git(["init", "-q"], repo);
    await git(["config", "user.email", "t@t.t"], repo);
    await git(["config", "user.name", "t"], repo);
    await writeFile(join(repo, "base.txt"), "line1\nline2\nline3\n");
    await git(["add", "."], repo);
    await git(["commit", "-qm", "init"], repo);
  });

  afterEach(async () => {
    if (repo) await rm(repo, { recursive: true, force: true });
  });

  test("clean tree reports no changes", async () => {
    const result = await durableWorkingTreeChanges(repo);
    expect(result.touchedFiles).toEqual([]);
    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(0);
  });

  test("unstaged modification counts add/del for the file only", async () => {
    await writeFile(join(repo, "base.txt"), "line1\nCHANGED\nline3\nline4\n");
    const result = await durableWorkingTreeChanges(repo);
    expect(result.touchedFiles).toEqual(["base.txt"]);
    // line2 -> CHANGED (1 add, 1 del) + line4 appended (1 add) = 2 add / 1 del
    expect(result.additions).toBe(2);
    expect(result.deletions).toBe(1);
  });

  test("untracked file is listed", async () => {
    await writeFile(join(repo, "new.txt"), "hello\n");
    const result = await durableWorkingTreeChanges(repo);
    expect(result.touchedFiles).toContain("new.txt");
  });

  test("staged and unstaged edits to same file are not double-counted", async () => {
    await writeFile(join(repo, "base.txt"), "line1\nstaged\nline3\n");
    await git(["add", "base.txt"], repo);
    await writeFile(join(repo, "base.txt"), "line1\nstaged\nline3\nunstaged\n");
    const result = await durableWorkingTreeChanges(repo);
    expect(result.touchedFiles).toEqual(["base.txt"]);
    // Max of staged (1/1) and unstaged (2/1) per file — not the sum.
    expect(result.additions).toBe(2);
    expect(result.deletions).toBe(1);
  });

  test("ignores .glib internal files", async () => {
    await mkdir(join(repo, ".glib"), { recursive: true });
    await writeFile(join(repo, ".glib", "state.json"), "{}\n");
    const result = await durableWorkingTreeChanges(repo);
    expect(result.touchedFiles.some((f) => f.startsWith(".glib"))).toBe(false);
  });
});
