import { join } from "node:path";
import { GitTrix } from "gittrix/packages/core/src/gittrix.js";
import { BaselineConflictError } from "gittrix/packages/core/src/errors.js";
import type { PromoteOpts, PromoteResult, UserSession } from "gittrix/packages/core/src/types.js";
import { LocalDurableAdapter, LocalEphemeralAdapter } from "./gittrix-local-adapter";
import { getConfigDir } from "../lib/paths";

export type StartGitTrixSessionResult = {
  gittrixSessionId: string;
  ephemeralPath: string;
  baselineSha: string;
};

export type BaselineConflict = {
  code: "BASELINE_CONFLICT";
  conflictingFiles: string[];
  durableSha: string;
  baselineSha: string;
};

const runtimes = new Map<string, { instance: GitTrix; ready: Promise<void> }>();

function sessionsRoot() {
  return join(getConfigDir(), "gittrix-sessions");
}

async function getRuntime(projectPath: string, branch?: string) {
  const key = `${projectPath}::${branch ?? "main"}`;
  const existing = runtimes.get(key);
  if (existing) {
    await existing.ready;
    return existing.instance;
  }

  const instance = new GitTrix({
    durable: new LocalDurableAdapter({ path: projectPath, branch: branch ?? "main" }),
    ephemeral: new LocalEphemeralAdapter({ sessionsRootDir: sessionsRoot() })
  });
  const ready = instance.init();
  runtimes.set(key, { instance, ready });
  await ready;
  return instance;
}

async function getUserSession(projectPath: string, gittrixSessionId: string, branch?: string): Promise<UserSession> {
  const rt = await getRuntime(projectPath, branch);
  return rt.getSession(gittrixSessionId);
}

export async function startSession(params: { projectPath: string; task: string; branch?: string }): Promise<StartGitTrixSessionResult> {
  const rt = await getRuntime(params.projectPath, params.branch);
  const session = await rt.startSession({ task: params.task, durablePath: params.projectPath, durableBranch: params.branch });
  const all = await rt.listSessions();
  const meta = all.find((item) => item.id === session.id);
  const fallbackPath = join(sessionsRoot(), session.id, "workspace");
  return {
    gittrixSessionId: session.id,
    ephemeralPath: meta?.ephemeralRef.replace(/^local:\/\//, "").split("#")[0] || fallbackPath,
    baselineSha: meta?.baselineSha ?? ""
  };
}

export async function diff(projectPath: string, gittrixSessionId: string, branch?: string) {
  const session = await getUserSession(projectPath, gittrixSessionId, branch);
  return session.diff();
}

export async function promote(
  projectPath: string,
  gittrixSessionId: string,
  opts: PromoteOpts,
  branch?: string
): Promise<PromoteResult> {
  try {
    const session = await getUserSession(projectPath, gittrixSessionId, branch);
    return await session.promote(opts);
  } catch (error) {
    if (error instanceof BaselineConflictError) {
      const payload: BaselineConflict = {
        code: "BASELINE_CONFLICT",
        conflictingFiles: error.conflictingFiles,
        durableSha: error.durableSha,
        baselineSha: error.baselineSha
      };
      throw payload;
    }
    throw error;
  }
}

export async function evict(projectPath: string, gittrixSessionId: string, branch?: string) {
  const rt = await getRuntime(projectPath, branch);
  await rt.evict(gittrixSessionId, "discarded");
}
