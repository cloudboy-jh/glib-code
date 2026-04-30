import { existsSync } from "node:fs";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentEvent } from "@glib-code/shared/events/agent";
import { ensureDir, repoGlibDir } from "../lib/paths";

export type SessionMeta = {
  id: string;
  projectId: string;
  projectPath: string;
  title: string;
  model: string;
  provider: string;
  status: "idle" | "running" | "aborted" | "error" | "done";
  createdAt: string;
  updatedAt: string;
};

type SessionDoc = {
  meta: SessionMeta;
  events: AgentEvent[];
};

function sessionsDir(repoPath: string) {
  return join(repoGlibDir(repoPath), "sessions");
}

function sessionPath(repoPath: string, sessionId: string) {
  return join(sessionsDir(repoPath), `${sessionId}.json`);
}

function nowIso() {
  return new Date().toISOString();
}

export function newSessionId() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `sess_${Date.now().toString(36)}_${rand}`;
}

async function ensureSessionsRoot(repoPath: string) {
  await ensureDir(sessionsDir(repoPath));
}

async function readSessionDoc(repoPath: string, sessionId: string): Promise<SessionDoc | null> {
  const path = sessionPath(repoPath, sessionId);
  if (!existsSync(path)) return null;
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as SessionDoc;
  } catch {
    return null;
  }
}

async function writeSessionDoc(repoPath: string, doc: SessionDoc) {
  await ensureSessionsRoot(repoPath);
  const path = sessionPath(repoPath, doc.meta.id);
  await writeFile(path, JSON.stringify(doc, null, 2), "utf8");
}

export async function createSession(params: {
  projectId: string;
  projectPath: string;
  title: string;
  model: string;
  provider: string;
}) {
  const id = newSessionId();
  const now = nowIso();
  const meta: SessionMeta = {
    id,
    projectId: params.projectId,
    projectPath: params.projectPath,
    title: params.title,
    model: params.model,
    provider: params.provider,
    status: "idle",
    createdAt: now,
    updatedAt: now
  };
  await writeSessionDoc(params.projectPath, { meta, events: [] });
  return meta;
}

export async function listSessions(projectPath: string) {
  const dir = sessionsDir(projectPath);
  if (!existsSync(dir)) return [] as SessionMeta[];
  const names = await readdir(dir);
  const metas: SessionMeta[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const raw = await readSessionDoc(projectPath, name.slice(0, -5));
    if (!raw) continue;
    metas.push(raw.meta);
  }
  return metas.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

export async function getSession(projectPath: string, sessionId: string) {
  return readSessionDoc(projectPath, sessionId);
}

export async function appendEvents(projectPath: string, sessionId: string, events: AgentEvent[]) {
  const doc = await readSessionDoc(projectPath, sessionId);
  if (!doc) return null;
  doc.events.push(...events);
  doc.meta.updatedAt = nowIso();
  await writeSessionDoc(projectPath, doc);
  return doc;
}

export async function patchSessionMeta(
  projectPath: string,
  sessionId: string,
  partial: Partial<Pick<SessionMeta, "title" | "status" | "model" | "provider">>
) {
  const doc = await readSessionDoc(projectPath, sessionId);
  if (!doc) return null;
  doc.meta = { ...doc.meta, ...partial, updatedAt: nowIso() };
  await writeSessionDoc(projectPath, doc);
  return doc.meta;
}

export async function deleteSession(projectPath: string, sessionId: string) {
  await rm(sessionPath(projectPath, sessionId), { force: true });
}

export async function forkSession(projectPath: string, sourceSessionId: string) {
  const source = await readSessionDoc(projectPath, sourceSessionId);
  if (!source) return null;
  const id = newSessionId();
  const now = nowIso();
  const meta: SessionMeta = {
    ...source.meta,
    id,
    title: `${source.meta.title} (fork)`,
    status: "idle",
    createdAt: now,
    updatedAt: now
  };
  const doc: SessionDoc = { meta, events: [...source.events] };
  await writeSessionDoc(projectPath, doc);
  return doc;
}
