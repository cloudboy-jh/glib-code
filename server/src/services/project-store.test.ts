import { beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getProjectOverride,
  loadProjectOverrides,
  resetProjectStoreForTests,
  setProjectOverride
} from "./project-store";

let root = "";

beforeEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = await mkdtemp(join(tmpdir(), "glib-project-store-"));
  process.env.GLIB_CONFIG_DIR = join(root, "config");
  process.env.APPDATA = root;
  resetProjectStoreForTests();
});

describe("project overrides", () => {
  test("persists overrides across a reload", async () => {
    await setProjectOverride("proj-a", { provider: "anthropic", model: "claude" });

    resetProjectStoreForTests();
    expect(getProjectOverride("proj-a")).toBeNull();

    await loadProjectOverrides();
    expect(getProjectOverride("proj-a")).toEqual({ provider: "anthropic", model: "claude" });
  });

  test("merges partial patches and clears empty fields", async () => {
    await setProjectOverride("proj-b", { provider: "openai", model: "gpt" });
    await setProjectOverride("proj-b", { model: "gpt-next" });
    expect(getProjectOverride("proj-b")).toEqual({ provider: "openai", model: "gpt-next" });

    // null clears just that field
    await setProjectOverride("proj-b", { provider: null });
    expect(getProjectOverride("proj-b")).toEqual({ model: "gpt-next" });
  });

  test("removes the entry entirely when fully cleared", async () => {
    await setProjectOverride("proj-c", { provider: "openai", model: "gpt" });
    await setProjectOverride("proj-c", { provider: null, model: null });
    expect(getProjectOverride("proj-c")).toBeNull();

    // and that emptiness survives a reload
    await loadProjectOverrides();
    expect(getProjectOverride("proj-c")).toBeNull();
  });
});
