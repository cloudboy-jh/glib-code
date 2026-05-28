import { Hono } from "hono";
import { exec } from "node:child_process";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { getSettings } from "../services/settings-store";
import { getCurrentProjectId, getProjectById } from "../services/project-store";
import { inRepo } from "../lib/paths";

const execAsync = promisify(exec);

const VALID_EDITORS = [
  "vscode",
  "cursor",
  "zed",
  "obsidian"
] as const;

type EditorId = typeof VALID_EDITORS[number];

async function activeProjectPath() {
  const current = getCurrentProjectId();
  if (!current) return null;
  return getProjectById(current)?.path ?? null;
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
    const { path, editor: requestedEditor } = body;
    const target = body.target === "project" ? "project" : "file";

    const root = await activeProjectPath();
    if (!root) return c.json({ ok: false, message: "no project open" }, 404);

    let fullPath = root;
    let label = "project";
    if (target === "file") {
      if (!path || typeof path !== "string") return c.json({ ok: false, message: "path required" }, 400);
      fullPath = resolve(join(root, path));
      label = path;
      if (!inRepo(root, fullPath)) return c.json({ ok: false, message: "path escape blocked" }, 400);
    }

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
