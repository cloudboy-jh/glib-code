import { Hono } from "hono";
import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { getSettings } from "../services/settings-store";
import { getCurrentProjectId, getProjectById } from "../services/project-store";
import { getSessionById } from "../services/session-store";
import { inRepo } from "../lib/paths";

const execAsync = promisify(exec);

const VALID_EDITORS = [
  "vscode",
  "cursor",
  "zed",
  "obsidian"
] as const;

type EditorId = typeof VALID_EDITORS[number];

async function activeProjectPath(projectPath?: string) {
  if (projectPath && projectPath.trim()) return projectPath.trim();
  const current = getCurrentProjectId();
  if (!current) return null;
  return getProjectById(current)?.path ?? null;
}

async function resolveOpenPath(
  root: string,
  target: "project" | "file",
  relativePath?: string,
  sessionId?: string
): Promise<{ fullPath: string; label: string; source: "ephemeral" | "durable" } | { ok: false; message: string; status: number }> {
  // Resolve ephemeral workspace if session provided
  let ephemeralPath: string | undefined;
  if (sessionId) {
    const sessionDoc = await getSessionById(sessionId);
    ephemeralPath = sessionDoc?.doc.meta.ephemeralPath;
  }

  if (target === "project") {
    const pathToOpen = ephemeralPath && existsSync(ephemeralPath) ? ephemeralPath : root;
    return { fullPath: pathToOpen, label: "project", source: ephemeralPath && existsSync(ephemeralPath) ? "ephemeral" : "durable" };
  }

  // target === "file"
  if (!relativePath || typeof relativePath !== "string") {
    return { ok: false, message: "path required", status: 400 };
  }

  // Try ephemeral first
  if (ephemeralPath) {
    const ephemeralFilePath = resolve(join(ephemeralPath, relativePath));
    if (inRepo(ephemeralPath, ephemeralFilePath) && existsSync(ephemeralFilePath)) {
      return { fullPath: ephemeralFilePath, label: relativePath, source: "ephemeral" };
    }
  }

  // Fall back to durable
  const durableFilePath = resolve(join(root, relativePath));
  if (!inRepo(root, durableFilePath)) {
    return { ok: false, message: "path escape blocked", status: 400 };
  }
  if (!existsSync(durableFilePath)) {
    return { ok: false, message: `file not found: ${relativePath}`, status: 404 };
  }

  return { fullPath: durableFilePath, label: relativePath, source: "durable" };
}

async function openInEditor(
  editor: EditorId,
  fullPath: string,
  label: string
): Promise<{ ok: boolean; message: string }> {
  try {
    let command: string;
    
    switch (editor) {
      case "vscode":
        command = `code "${fullPath}"`;
        break;
      case "cursor":
        command = `cursor "${fullPath}"`;
        break;
      case "zed":
        command = `zed "${fullPath}"`;
        break;
      case "obsidian":
        command = `start "" "obsidian://open?path=${encodeURIComponent(fullPath)}"`;
        break;
      default:
        return { ok: false, message: `unsupported editor: ${editor}` };
    }

    if (process.platform === "win32" && editor === "obsidian") {
      await execAsync(`powershell -Command "Start-Process 'obsidian://open?path=${encodeURIComponent(fullPath)}'"`);
    } else {
      await execAsync(command);
    }

    return { ok: true, message: `opened ${label} in ${editor}` };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `failed to open: ${errorMessage}` };
  }
}

export const openRoutes = new Hono()
  .post("/editor", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { path, editor: requestedEditor, sessionId } = body;
    const target = body.target === "project" ? "project" : "file";

    const root = await activeProjectPath(body.projectPath);
    if (!root) return c.json({ ok: false, message: "no project open" }, 404);

    const resolved = await resolveOpenPath(root, target, path, sessionId);
    if ("ok" in resolved && resolved.ok === false) {
      return c.json({ ok: false, message: resolved.message }, resolved.status as 400 | 404);
    }

    const { fullPath, label } = resolved as { fullPath: string; label: string };

    let editor: string | null = requestedEditor ?? null;
    
    if (!editor) {
      const settings = await getSettings();
      editor = settings.preferredEditor;
    }

    if (!editor) {
      return c.json({ ok: false, message: "no preferred editor set. go to settings > integrations to configure one." }, 400);
    }

    if (!VALID_EDITORS.includes(editor as EditorId)) {
      return c.json({ ok: false, message: `invalid editor. must be one of: ${VALID_EDITORS.join(", ")}` }, 400);
    }

    const result = await openInEditor(editor as EditorId, fullPath, label);
    if (!result.ok) {
      return c.json(result, 400);
    }

    return c.json(result);
  });
