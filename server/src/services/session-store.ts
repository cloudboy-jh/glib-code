import { existsSync } from "node:fs";
import { readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import type { AgentEvent } from "@glib-code/shared/events/agent";
import { ensureDir, getConfigDir, repoGlibDir } from "../lib/paths";
import { writeJsonAtomic } from "../lib/atomic-write";
import { canonicalProjectPath } from "../lib/project-path";

function normalizeProjectPath(path: string) {
  return canonicalProjectPath(path) ?? path.replace(/\\/g, "/").trim();
}

export type PromoteEntry = {
  at: string;
  fromSha: string | null;
  toSha: string | null;
  fileCount: number;
};

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
  isGitBacked?: boolean;
  workspaceKind?: "worktree" | "clone" | "copy" | "remote";
  status: "idle" | "running" | "aborted" | "error" | "done";
  totalCost: number;
  totalTokens: { input: number; output: number; reasoning: number; cacheRead: number; cacheWrite: number };
  createdAt: string;
  updatedAt: string;
  promoteHistory?: PromoteEntry[];
};

type SessionDoc = {
  meta: SessionMeta;
  events: AgentEvent[];
};

type SessionIndex = Record<string, string>;

const sessionWriteLocks = new Map<string, Promise<unknown>>();
let indexWriteLock: Promise<unknown> = Promise.resolve();

function sessionIndexPath() {
  return join(getConfigDir(), "sessions-index.json");
}

function sessionsDir(repoPath: string) {
  return join(repoGlibDir(normalizeProjectPath(repoPath)), "sessions");
}

function sessionPath(repoPath: string, sessionId: string) {
  return join(sessionsDir(repoPath), `${sessionId}.json`);
}

function sessionLockKey(repoPath: string, sessionId: string) {
  return `${normalizeProjectPath(repoPath)}:${sessionId}`;
}

async function withSessionWriteLock<T>(repoPath: string, sessionId: string, fn: () => Promise<T>): Promise<T> {
  const key = sessionLockKey(repoPath, sessionId);
  const previous = sessionWriteLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.catch(() => undefined).then(() => current);
  sessionWriteLocks.set(key, queued);
  await previous.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
    if (sessionWriteLocks.get(key) === queued) sessionWriteLocks.delete(key);
  }
}

async function withIndexWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const previous = indexWriteLock;
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.catch(() => undefined).then(() => current);
  indexWriteLock = queued;
  await previous.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
    if (indexWriteLock === queued) indexWriteLock = Promise.resolve();
  }
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
  await writeJsonAtomic(sessionPath(repoPath, doc.meta.id), doc);
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
  await ensureDir(getConfigDir());
  await writeJsonAtomic(sessionIndexPath(), index);
}

async function indexSession(sessionId: string, projectPath: string) {
  projectPath = normalizeProjectPath(projectPath);
  await withIndexWriteLock(async () => {
    const index = await readSessionIndex();
    if (index[sessionId] === projectPath) return;
    index[sessionId] = projectPath;
    await writeSessionIndex(index);
  });
}

async function unindexSession(sessionId: string, projectPath?: string) {
  if (projectPath) projectPath = normalizeProjectPath(projectPath);
  await withIndexWriteLock(async () => {
    const index = await readSessionIndex();
    if (!index[sessionId]) return;
    if (projectPath && index[sessionId] !== projectPath) return;
    delete index[sessionId];
    await writeSessionIndex(index);
  });
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
  isGitBacked?: boolean;
  workspaceKind?: "worktree" | "clone" | "copy" | "remote";
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
    isGitBacked: params.isGitBacked,
    workspaceKind: params.workspaceKind,
    status: "idle",
    totalCost: 0,
    totalTokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
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
  return withSessionWriteLock(projectPath, sessionId, async () => {
    const doc = await readSessionDoc(projectPath, sessionId);
    if (!doc) return null;
    doc.events.push(...events);
    doc.meta.updatedAt = nowIso();
    await writeSessionDoc(projectPath, doc);
    return doc;
  });
}

export async function patchSessionMeta(
  projectPath: string,
  sessionId: string,
  partial: Partial<Pick<SessionMeta, "title" | "status" | "model" | "provider" | "totalCost" | "totalTokens" | "promoteHistory">>
) {
  projectPath = normalizeProjectPath(projectPath);
  return withSessionWriteLock(projectPath, sessionId, async () => {
    const doc = await readSessionDoc(projectPath, sessionId);
    if (!doc) return null;
    doc.meta = { ...doc.meta, ...partial, updatedAt: nowIso() };
    await writeSessionDoc(projectPath, doc);
    return doc.meta;
  });
}

export async function deleteSession(projectPath: string, sessionId: string) {
  projectPath = normalizeProjectPath(projectPath);
  await withSessionWriteLock(projectPath, sessionId, async () => {
    await rm(sessionPath(projectPath, sessionId), { force: true });
    await unindexSession(sessionId, projectPath);
  });
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
    totalCost: 0,
    totalTokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
    createdAt: now,
    updatedAt: now
  };
  const doc: SessionDoc = { meta, events: [...source.events] };
  await writeSessionDoc(projectPath, doc);
  await indexSession(id, projectPath);
  return doc;
}
