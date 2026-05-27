import { beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendEvents, createSession, getSession, getSessionById, patchSessionMeta } from "./session-store";
import type { AgentEvent } from "@glib-code/shared/events/agent";
import { canonicalProjectPath } from "../lib/project-path";

let root = "";
let repo = "";

beforeEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = await mkdtemp(join(tmpdir(), "glib-session-store-"));
  process.env.GLIB_CONFIG_DIR = join(root, "config");
  process.env.APPDATA = root;
  repo = join(root, "repo");
  await mkdir(repo, { recursive: true });
});

function textEvent(index: number): AgentEvent {
  return {
    type: "text_part",
    turnId: `turn_${index}`,
    stepId: `step_${index}`,
    partId: `part_${index}`,
    text: `chunk ${index}`,
    at: new Date(index).toISOString()
  };
}

describe("session store", () => {
  test("preserves concurrent event and metadata writes", async () => {
    const session = await createSession({ projectId: "project", projectPath: repo, title: "A", model: "m", provider: "p" });

    await Promise.all([
      ...Array.from({ length: 40 }, (_, index) => appendEvents(repo, session.id, [textEvent(index)])),
      ...Array.from({ length: 10 }, (_, index) => patchSessionMeta(repo, session.id, { title: `title ${index}` }))
    ]);

    const doc = await getSession(repo, session.id);
    expect(doc?.events).toHaveLength(40);
    expect(new Set(doc?.events.map((event) => event.type === "text_part" ? event.partId : "")).size).toBe(40);
    expect(doc?.meta.title.startsWith("title ")).toBe(true);
  });

  test("indexes sessions while concurrent writes are happening", async () => {
    const session = await createSession({ projectId: "project", projectPath: repo, title: "A", model: "m", provider: "p" });

    await Promise.all(Array.from({ length: 20 }, (_, index) => appendEvents(repo, session.id, [textEvent(index)])));

    const indexed = await getSessionById(session.id);
    expect(canonicalProjectPath(indexed?.projectPath ?? "")).toBe(canonicalProjectPath(repo));
    expect(indexed?.doc.events).toHaveLength(20);
  });
});
