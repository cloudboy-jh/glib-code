// Boundary state service — single source of truth for the right-rail
// ephemeral/durable diff state. Derives the boundary payload from whichever
// surface actually holds the agent's changes (Gittrix ephemeral workspace for
// git-backed sessions, durable working tree for copy/native-tool sessions).
//
// Exposes computeBoundary() for both the HTTP hydration endpoint and the
// event-driven SSE push. A short TTL cache debounces the HTTP path only —
// callers that mutate state (turn_end, promote, discard) must clearBoundaryCache
// so the next compute reflects reality immediately.

import type { BoundaryPayload, BoundaryState } from "@glib-code/shared/events/agent";
import type { SessionMeta } from "./session-store";
import { getProjectById } from "./project-store";
import * as gittrixService from "./gittrix-service";
import { logError } from "../lib/log";

const BOUNDARY_CACHE_TTL_MS = 10_000;

type BoundaryCacheEntry = { payload: BoundaryPayload; cachedAt: number };
const boundaryCache = new Map<string, BoundaryCacheEntry>();

export function clearBoundaryCache(gittrixSessionId?: string | null) {
  if (!gittrixSessionId) return;
  boundaryCache.delete(gittrixSessionId);
}

function boundaryFromCache(gittrixSessionId: string): BoundaryPayload | null {
  const entry = boundaryCache.get(gittrixSessionId);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > BOUNDARY_CACHE_TTL_MS) {
    boundaryCache.delete(gittrixSessionId);
    return null;
  }
  return entry.payload;
}

function putBoundaryCache(gittrixSessionId: string, payload: BoundaryPayload) {
  boundaryCache.set(gittrixSessionId, { payload, cachedAt: Date.now() });
}

export function diffStats(patch: string): { additions: number; deletions: number } {
  const additions = (patch.match(/^\+(?!\+\+)/gm) ?? []).length;
  const deletions = (patch.match(/^-(?!--)/gm) ?? []).length;
  return { additions, deletions };
}

export function filesFromPatch(patch: string): string[] {
  const files = new Set<string>();
  // git-style headers: `diff --git a/X b/X`
  for (const match of patch.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)) files.add((match[2] || match[1] || "").trim());
  // jsdiff createPatch headers (used by gittrix): `Index: X`
  for (const match of patch.matchAll(/^Index:\s+(.+?)\s*$/gm)) {
    const file = (match[1] || "").trim();
    if (file) files.add(file);
  }
  // `+++ b/X` (git) and `+++ X\tb` (jsdiff) — stop at tab OR end of line.
  for (const match of patch.matchAll(/^\+\+\+\s+(?:b\/)?([^\t\n\r]+?)(?:\t.*)?$/gm)) {
    const file = (match[1] || "").trim();
    if (file && file !== "/dev/null") files.add(file);
  }
  return [...files].filter(Boolean);
}

// Detects uncommitted working-tree changes in the durable repo (files the agent
// wrote directly via native Edit/Write tools, bypassing the Gittrix workspace).
// Uses `git diff --numstat HEAD` (unstaged) + `git diff --cached --numstat`
// (staged) + `git ls-files --others` (untracked) so it only sees actual
// working-tree dirt, never unrelated committed history.
export async function durableWorkingTreeChanges(
  projectPath: string
): Promise<{ touchedFiles: string[]; additions: number; deletions: number }> {
  async function numstat(extraArgs: string[]): Promise<{ file: string; add: number; del: number }[]> {
    const proc = Bun.spawn({
      cmd: ["git", "diff", "--numstat", ...extraArgs, "--"],
      cwd: projectPath,
      stdout: "pipe",
      stderr: "pipe",
    });
    const code = await proc.exited;
    if (code !== 0) return [];
    const stdout = await new Response(proc.stdout).text();
    const rows: { file: string; add: number; del: number }[] = [];
    for (const line of stdout.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split("\t");
      if (parts.length < 3) continue;
      const [add, del, ...fileParts] = parts;
      const file = fileParts.join("\t").replace(/\\/g, "/");
      if (!file || file === ".glib" || file.startsWith(".glib/")) continue;
      rows.push({ file, add: add === "-" ? 0 : parseInt(add, 10) || 0, del: del === "-" ? 0 : parseInt(del, 10) || 0 });
    }
    return rows;
  }

  async function untrackedFiles(): Promise<string[]> {
    const proc = Bun.spawn({
      cmd: ["git", "ls-files", "--others", "--exclude-standard"],
      cwd: projectPath,
      stdout: "pipe",
      stderr: "pipe",
    });
    const code = await proc.exited;
    if (code !== 0) return [];
    return (await new Response(proc.stdout).text())
      .split("\n")
      .map((l) => l.trim().replace(/\\/g, "/"))
      .filter((f) => f && f !== ".glib" && !f.startsWith(".glib/"));
  }

  const [unstaged, staged, untracked] = await Promise.all([
    numstat(["HEAD"]),
    numstat(["--cached"]),
    untrackedFiles(),
  ]);

  const seen = new Map<string, { add: number; del: number }>();
  for (const { file, add, del } of [...unstaged, ...staged]) {
    const prev = seen.get(file) ?? { add: 0, del: 0 };
    // Take the max of staged/unstaged per file to avoid double-counting
    seen.set(file, { add: Math.max(prev.add, add), del: Math.max(prev.del, del) });
  }
  for (const file of untracked) {
    if (!seen.has(file)) seen.set(file, { add: 0, del: 0 });
  }

  let additions = 0;
  let deletions = 0;
  for (const { add, del } of seen.values()) {
    additions += add;
    deletions += del;
  }

  const touchedFiles = [...seen.keys()].sort((a, b) => a.localeCompare(b));
  return { touchedFiles, additions, deletions };
}

function basePayload(meta: SessionMeta, overrides: Partial<BoundaryPayload>): BoundaryPayload {
  return {
    state: "clean",
    touchedFiles: [],
    touchedFileCount: 0,
    additions: 0,
    deletions: 0,
    baselineSha: meta.baselineSha ?? null,
    lastPromotedAt: meta.promoteHistory?.at(-1)?.at ?? null,
    promoteHistory: meta.promoteHistory ?? [],
    ...overrides,
  };
}

// True when the durable repo working tree is the surface the agent writes to
// (copy workspaces and sessions with no git-backed ephemeral workspace).
function usesDurableWorkingTree(meta: SessionMeta): boolean {
  return meta.workspaceKind === "copy" || meta.isGitBacked === false;
}

export type ComputeBoundaryOptions = {
  // When true, bypass the TTL cache and force a fresh compute. Used by the
  // event-driven push path after a mutating tool call / turn end.
  fresh?: boolean;
};

// Derives the full boundary payload for a session. Cheap when cached (HTTP poll
// path); forced fresh after mutations (SSE push path).
export async function computeBoundary(
  meta: SessionMeta,
  projectPath: string,
  options: ComputeBoundaryOptions = {}
): Promise<BoundaryPayload> {
  if (!meta.gittrixSessionId) {
    return basePayload(meta, { state: "no_workspace" });
  }

  if (!options.fresh) {
    const cached = boundaryFromCache(meta.gittrixSessionId);
    if (cached) return cached;
  }

  const project = getProjectById(meta.projectId);
  const branch = project?.branch ?? "main";

  try {
    let touchedFiles: string[];
    let additions: number;
    let deletions: number;

    if (usesDurableWorkingTree(meta)) {
      // Agent writes land directly in the durable repo working tree.
      const durable = await durableWorkingTreeChanges(projectPath);
      touchedFiles = durable.touchedFiles;
      additions = durable.additions;
      deletions = durable.deletions;
    } else {
      // Git-backed ephemeral workspace (worktree/clone/remote) — the Gittrix
      // diff is the sole authority. We intentionally do NOT fall back to the
      // durable working tree here: the durable repo is shared across every
      // session of the project, so its dirt cannot be attributed to this
      // session and would bleed leftover changes into fresh sessions.
      const patch = await gittrixService.diff(projectPath, meta.gittrixSessionId, branch);
      touchedFiles = filesFromPatch(patch);
      const stats = diffStats(patch);
      additions = stats.additions;
      deletions = stats.deletions;
    }

    const hasPendingChanges = touchedFiles.length > 0;
    const payload = basePayload(meta, {
      state: hasPendingChanges ? "pending" : "clean",
      touchedFiles,
      touchedFileCount: touchedFiles.length,
      additions,
      deletions,
    });
    putBoundaryCache(meta.gittrixSessionId, payload);
    return payload;
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "SESSION_EXPIRED") {
      return basePayload(meta, { state: "clean", alreadyPromoted: true });
    }
    logError("server", "boundary compute failed", error, {
      sessionId: meta.id,
      gittrixSessionId: meta.gittrixSessionId,
      projectPath,
    });
    throw error;
  }
}

// Builds the SSE event payload from a computed boundary.
export function toBoundaryEvent(sessionId: string, payload: BoundaryPayload) {
  return {
    type: "boundary_changed" as const,
    sessionId,
    at: new Date().toISOString(),
    ...payload,
  };
}

export type { BoundaryPayload, BoundaryState };
