import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getConfigDir } from "../lib/paths";
import { writeJsonAtomic } from "../lib/atomic-write";

export type ProjectEntry = {
  id: string;
  name: string;
  path: string;
  lastOpenedAt: string;
};

export type RegisteredProject = {
  id: string;
  name: string;
  path: string;
  branch: string;
  isGitRepo: true;
};

export type ProjectOverride = {
  provider?: string;
  model?: string;
};

type Store = {
  currentProjectId: string | null;
  projectsById: Map<string, RegisteredProject>;
  projectOverrides: Map<string, ProjectOverride>;
};

const store: Store = {
  currentProjectId: null,
  projectsById: new Map(),
  projectOverrides: new Map()
};

function cfg(name: string) {
  return join(getConfigDir(), name);
}

async function writeAtomic(path: string, value: unknown) {
  await writeJsonAtomic(path, value);
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  if (!existsSync(path)) return fallback;
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function getRecents() {
  const recents = await readJson<ProjectEntry[]>(cfg("recents.json"), []);
  return recents.sort((a, b) => +new Date(b.lastOpenedAt) - +new Date(a.lastOpenedAt));
}

export async function putRecent(entry: Omit<ProjectEntry, "lastOpenedAt">) {
  const recents = await getRecents();
  const now = new Date().toISOString();
  const next = [
    { ...entry, lastOpenedAt: now },
    ...recents.filter((r) => r.id !== entry.id)
  ].slice(0, 20);
  await writeAtomic(cfg("recents.json"), next);
  return next;
}

export async function removeRecent(id: string) {
  const recents = await getRecents();
  const next = recents.filter((r) => r.id !== id);
  await writeAtomic(cfg("recents.json"), next);
  if (store.currentProjectId === id) store.currentProjectId = null;
}

export function setCurrentProject(id: string | null) {
  store.currentProjectId = id;
}

export function getCurrentProjectId() {
  return store.currentProjectId;
}

export function registerProject(project: RegisteredProject) {
  store.projectsById.set(project.id, project);
}

export function getProjectById(id: string) {
  return store.projectsById.get(id) ?? null;
}

export function listRegisteredProjects() {
  return [...store.projectsById.values()];
}

export function setProjectOverride(projectId: string, override: ProjectOverride) {
  const next = { ...(store.projectOverrides.get(projectId) ?? {}), ...override };
  store.projectOverrides.set(projectId, next);
  return next;
}

export function getProjectOverride(projectId: string) {
  return store.projectOverrides.get(projectId) ?? null;
}

export function resetProjectStoreForTests() {
  store.currentProjectId = null;
  store.projectsById.clear();
  store.projectOverrides.clear();
}
