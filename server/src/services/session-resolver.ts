import { existsSync } from "node:fs";
import { getCurrentProjectId, getProjectById } from "./project-store";
import { getSession, getSessionById } from "./session-store";
import { canonicalProjectPath } from "../lib/project-path";

export function normalizeProjectPath(value?: string | null) {
  return canonicalProjectPath(value);
}

export function requiredProjectPath(value: unknown) {
  return typeof value === "string" && value.trim() ? normalizeProjectPath(value) : null;
}

export function currentProject() {
  const projectId = getCurrentProjectId();
  if (!projectId) return null;
  return getProjectById(projectId);
}

export async function resolveSession(projectPath: string | null, sessionId: string) {
  const normalizedRequestPath = normalizeProjectPath(projectPath);
  const indexed = await getSessionById(sessionId);
  if (indexed) return { existing: indexed.doc, projectPath: normalizeProjectPath(indexed.projectPath) ?? indexed.projectPath };

  const project = currentProject();
  const candidates = [normalizedRequestPath, normalizeProjectPath(project?.path)].filter(Boolean) as string[];
  for (const candidate of [...new Set(candidates)]) {
    const existing = await getSession(candidate, sessionId);
    if (existing) return { existing, projectPath: normalizeProjectPath(existing.meta.projectPath) ?? candidate };
  }

  return { existing: null, projectPath: normalizedRequestPath || normalizeProjectPath(project?.path) };
}

export function resolveAgentCwd(projectPath: string, ephemeralPath?: string, isGitBacked?: boolean) {
  const normalizedEphemeral = normalizeProjectPath(ephemeralPath);
  if (isGitBacked === true && normalizedEphemeral && existsSync(`${normalizedEphemeral}/.git`)) return normalizedEphemeral;
  return normalizeProjectPath(projectPath) ?? projectPath;
}
