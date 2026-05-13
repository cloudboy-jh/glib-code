import { existsSync } from "node:fs";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentEvent } from "@glib-code/shared/events/agent";
import { ensureDir, getConfigDir, repoGlibDir } from "../lib/paths";

function normalizeProjectPath(path: string) {
  return path.replace(/\\/g, "/");
}

export type SessionMeta = {
  id: string;
  projectId: string;
  projectPath: string;
  title: string;
  model: string;
  provider: string;
  gittrixSessionId?: string;
  ephemeralPath?: string;
  baselineSha?: string;
  status: "idle" | "running" | "aborted" | "error" | "done";
  createdAt: string;
  updatedAt: string;
};

type SessionDoc = {
  meta: SessionMeta;
  events: AgentEvent[];
};

type SessionIndex = Record<string, string>;

function sessionIndexPath() {
  return join(getConfigDir(), "sessions-index.json");
}

function sessionsDir(repoPath: string) {
  return join(repoGlibDir(normalizeProjectPath(repoPath)), "sessions");
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

async function readSessionIndex(): Promise<SessionIndex> {
  const path = sessionIndexPath();
  if (!existsSync(path)) return {};
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as SessionIndex;
  } catch {
    return {};
  }
}

async function writeSessionIndex(index: SessionIndex) {
  const path = sessionIndexPath();
  await ensureDir(getConfigDir());
  await writeFile(path, JSON.stringify(index, null, 2), "utf8");
}

async function indexSession(sessionId: string, projectPath: string) {
  projectPath = normalizeProjectPath(projectPath);
  const index = await readSessionIndex();
  if (index[sessionId] === projectPath) return;
  index[sessionId] = projectPath;
  await writeSessionIndex(index);
}

async function unindexSession(sessionId: string, projectPath?: string) {
  if (projectPath) projectPath = normalizeProjectPath(projectPath);
  const index = await readSessionIndex();
  if (!index[sessionId]) return;
  if (projectPath && index[sessionId] !== projectPath) return;
  delete index[sessionId];
  await writeSessionIndex(index);
}

export async function createSession(params: {
  projectId: string;
  projectPath: string;
  title: string;
  model: string;
  provider: string;
  gittrixSessionId?: string;
  ephemeralPath?: string;
  baselineSha?: string;
}) {
  const projectPath = normalizeProjectPath(params.projectPath);
  const id = newSessionId();
  const now = nowIso();
  const meta: SessionMeta = {
    id,
    projectId: params.projectId,
    projectPath,
    title: params.title,
    model: params.model,
    provider: params.provider,
    gittrixSessionId: params.gittrixSessionId,
    ephemeralPath: params.ephemeralPath,
    baselineSha: params.baselineSha,
    status: "idle",
    createdAt: now,
    updatedAt: now
  };
  await writeSessionDoc(projectPath, { meta, events: [] });
  await indexSession(id, projectPath);
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
    await indexSession(raw.meta.id, raw.meta.projectPath || projectPath);
    metas.push(raw.meta);
  }
  return metas.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

export async function getSession(projectPath: string, sessionId: string) {
  projectPath = normalizeProjectPath(projectPath);
  const doc = await readSessionDoc(projectPath, sessionId);
  if (doc) await indexSession(sessionId, doc.meta.projectPath || projectPath);
  return doc;
}

export async function getSessionById(sessionId: string) {
  const index = await readSessionIndex();
  const projectPath = index[sessionId];
  if (!projectPath) return null;

  const doc = await readSessionDoc(projectPath, sessionId);
  if (doc) return { projectPath: doc.meta.projectPath || projectPath, doc };

  await unindexSession(sessionId, projectPath);
  return null;
}

export async function appendEvents(projectPath: string, sessionId: string, events: AgentEvent[]) {
  projectPath = normalizeProjectPath(projectPath);
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
  projectPath = normalizeProjectPath(projectPath);
  const doc = await readSessionDoc(projectPath, sessionId);
  if (!doc) return null;
  doc.meta = { ...doc.meta, ...partial, updatedAt: nowIso() };
  await writeSessionDoc(projectPath, doc);
  return doc.meta;
}

export async function deleteSession(projectPath: string, sessionId: string) {
  projectPath = normalizeProjectPath(projectPath);
  await rm(sessionPath(projectPath, sessionId), { force: true });
  await unindexSession(sessionId, projectPath);
}

export async function forkSession(projectPath: string, sourceSessionId: string) {
  projectPath = normalizeProjectPath(projectPath);
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
  await indexSession(id, projectPath);
  return doc;
}
