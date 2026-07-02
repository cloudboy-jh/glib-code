import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type { Api, Context, Model } from "@mariozechner/pi-ai";
import { complete } from "@mariozechner/pi-ai";
import { getAttachment, type AttachmentMeta } from "../routes/attachments";
import { getPiCore } from "./pi-core";
import { getPiCapabilities } from "./pi-capabilities";
import { getOpenRouterCatalog } from "./openrouter-catalog";
import { getSettings } from "./settings-store";
import { logError } from "../lib/log";

export type CompiledArtifact = { id: string; block: string };

// Truncate text-like attachments so a single paste can't blow the context.
const TEXT_LIMIT_BYTES = 16 * 1024;
// Sidecar describe calls are best-effort; never let one hold up the turn.
const ATTACHMENT_TIMEOUT_MS = 20_000;

// File extensions we treat as text even when the browser reports a generic or
// empty MIME type (application/octet-stream is common for source files).
const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".jsonc",
  ".md", ".markdown", ".txt", ".log", ".csv", ".tsv",
  ".py", ".rb", ".go", ".rs", ".java", ".kt", ".swift", ".c", ".h",
  ".cpp", ".cc", ".hpp", ".cs", ".php", ".pl", ".lua", ".r", ".scala",
  ".css", ".scss", ".sass", ".less", ".html", ".htm", ".xml", ".svg",
  ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf", ".env",
  ".sh", ".bash", ".zsh", ".fish", ".ps1", ".bat",
  ".sql", ".graphql", ".gql", ".proto", ".dockerfile", ".gitignore"
]);

const IMAGE_CLASSES = new Set([
  "terminal_screenshot", "ui_screenshot", "diagram", "chart", "photo", "document"
]);

const VISION_SYSTEM_PROMPT = `You transcribe an image into plain text for another AI agent that cannot see it.

Step 1 — classify the image as exactly one of:
terminal_screenshot | ui_screenshot | diagram | chart | photo | document

Step 2 — extract accordingly:
- terminal_screenshot / code: verbatim transcription preserving layout, indentation, and line breaks.
- ui_screenshot: structured description of layout, components, and ALL visible text.
- diagram: reproduce it as a Mermaid diagram.
- chart: reproduce the data as a Markdown table.
- photo / document: a dense, information-rich caption.

Output format — first line is exactly:
class: <one of the labels above>
Then a blank line, then the extraction. Return plain text only, no code fences around the whole thing.`;

// Injectable sidecar for tests: describe an image, returning raw model text
// (including the leading `class:` line). Overridden via __setVisionSidecarForTests.
type VisionSidecar = (
  attachment: AttachmentMeta,
  target: { provider: string; model: string },
  signal: AbortSignal
) => Promise<string>;

let visionSidecar: VisionSidecar = defaultVisionSidecar;

// Injectable model picker for tests so image paths don't depend on real pi auth
// discovery. Defaults to the live capability-driven picker below.
type VisionModelPicker = (
  session: { provider: string; model: string }
) => Promise<{ provider: string; model: string } | null>;
let visionModelPicker: VisionModelPicker = defaultPickVisionModel;

/** Test-only override for the vision describe call. Returns a restore fn. */
export function __setVisionSidecarForTests(fn: VisionSidecar) {
  const prev = visionSidecar;
  visionSidecar = fn;
  return () => {
    visionSidecar = prev;
  };
}

/** Test-only override for vision model selection. Returns a restore fn. */
export function __setVisionModelPickerForTests(fn: VisionModelPicker) {
  const prev = visionModelPicker;
  visionModelPicker = fn;
  return () => {
    visionModelPicker = prev;
  };
}

function escapeAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isTextLike(meta: AttachmentMeta) {
  const type = meta.type.toLowerCase();
  if (type.startsWith("text/")) return true;
  if (type === "application/json" || type === "application/xml" || type === "application/x-yaml") return true;
  const ext = extname(meta.name).toLowerCase();
  return CODE_EXTENSIONS.has(ext);
}

function textBlock(id: string, name: string, content: string) {
  return [
    `<attachment id="${escapeAttr(id)}" name="${escapeAttr(name)}" kind="text" fidelity="high">`,
    content,
    `</attachment>`
  ].join("\n");
}

function imageBlock(id: string, name: string, classification: string, extraction: string) {
  return [
    `<attachment id="${escapeAttr(id)}" name="${escapeAttr(name)}" kind="image" class="${escapeAttr(classification)}" fidelity="approx">`,
    extraction,
    `</attachment>`
  ].join("\n");
}

function imageUnavailableBlock(id: string, name: string, note: string) {
  return [
    `<attachment id="${escapeAttr(id)}" name="${escapeAttr(name)}" kind="image" fidelity="none">`,
    `[${note}]`,
    `</attachment>`
  ].join("\n");
}

function binaryBlock(meta: AttachmentMeta) {
  return [
    `<attachment id="${escapeAttr(meta.id)}" name="${escapeAttr(meta.name)}" kind="binary" fidelity="none" type="${escapeAttr(meta.type)}" size="${meta.size}">`,
    `[binary file; contents not compiled to text]`,
    `</attachment>`
  ].join("\n");
}

async function compileText(meta: AttachmentMeta): Promise<string> {
  const buffer = await readFile(meta.path);
  const total = buffer.byteLength;
  const slice = buffer.subarray(0, TEXT_LIMIT_BYTES);
  let content = new TextDecoder().decode(slice);
  if (total > TEXT_LIMIT_BYTES) {
    content += `\n[truncated: ${slice.byteLength} of ${total} bytes]`;
  }
  return textBlock(meta.id, meta.name, content);
}

// Pick a vision model to describe the image with.
// Order:
//   1. the session's own provider+model, if it's authed and accepts images
//      (fewest deps, no surprise second-provider billing)
//   2. any image-capable model on the session's provider (cheapest transcription
//      path when the session model itself is text-only)
//   3. a cheap image model on any authed provider: claude haiku -> gemini flash
//      -> any image-capable model
async function defaultPickVisionModel(
  session: { provider: string; model: string }
): Promise<{ provider: string; model: string } | null> {
  const capabilities = await getPiCapabilities();
  if (!capabilities.ok) return null;
  const authed = new Map(capabilities.providers.filter((p) => p.hasAuth).map((p) => [p.id, new Set(p.modelIds)]));
  if (authed.size === 0) return null;

  // Which model IDs accept image input? OpenRouter exposes this via the live
  // catalog; other providers via the pi model registry. Both carry `input`.
  const imageModelIds = new Set<string>();
  try {
    const { modelRegistry } = await getPiCore();
    for (const model of modelRegistry.getAll()) {
      if (model.input?.includes("image")) imageModelIds.add(`${model.provider}/${model.id}`);
    }
  } catch {
    // registry unavailable; fall through to catalog + heuristics
  }
  try {
    const catalog = await getOpenRouterCatalog();
    for (const model of catalog) {
      if (model.input.includes("image")) imageModelIds.add(`openrouter/${model.id}`);
    }
  } catch {
    // catalog unavailable; heuristics below still apply
  }

  const hasImageInput = (provider: string, modelId: string) =>
    imageModelIds.has(`${provider}/${modelId}`);

  // 1. The session's exact model, if authed and vision-capable.
  const sessionModels = session.provider ? authed.get(session.provider) : undefined;
  if (
    session.provider &&
    session.model &&
    sessionModels?.has(session.model) &&
    hasImageInput(session.provider, session.model)
  ) {
    return { provider: session.provider, model: session.model };
  }

  // 2. Any image-capable model on the session's provider.
  if (session.provider && sessionModels) {
    for (const modelId of sessionModels) {
      if (hasImageInput(session.provider, modelId)) return { provider: session.provider, model: modelId };
    }
  }

  // 3. Cheap image model on any authed provider.
  const preferences: Array<(provider: string, modelId: string) => boolean> = [
    (_p, m) => /claude.*haiku/i.test(m),
    (_p, m) => /gemini.*flash/i.test(m),
    (p, m) => hasImageInput(p, m)
  ];

  for (const matches of preferences) {
    for (const [provider, modelIds] of authed) {
      for (const modelId of modelIds) {
        if (matches(provider, modelId)) return { provider, model: modelId };
      }
    }
  }
  return null;
}

async function defaultVisionSidecar(
  attachment: AttachmentMeta,
  target: { provider: string; model: string },
  signal: AbortSignal
): Promise<string> {
  const { modelRegistry } = await getPiCore();
  const model = modelRegistry.find(target.provider, target.model) as Model<Api> | undefined;
  if (!model) throw new Error(`vision model not found: ${target.provider}/${target.model}`);

  const auth = await modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok) throw new Error(auth.error);

  const buffer = await readFile(attachment.path);
  const context: Context = {
    systemPrompt: VISION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `Transcribe this image (filename: ${attachment.name}).` },
          { type: "image", data: buffer.toString("base64"), mimeType: attachment.type || "image/png" }
        ],
        timestamp: Date.now()
      }
    ]
  };

  const result = await complete(model, context, {
    apiKey: auth.apiKey,
    headers: auth.headers,
    signal,
    maxTokens: 2048
  });

  const text = result.content
    .map((part) => (part.type === "text" ? part.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
  if (!text) throw new Error("vision model returned no text");
  return text;
}

// Split the sidecar's `class: <label>` preamble from the extraction body.
function parseVisionOutput(raw: string): { classification: string; extraction: string } {
  const match = raw.match(/^\s*class\s*:\s*([a-z_]+)\s*\n?/i);
  if (match) {
    const candidate = match[1].toLowerCase();
    const classification = IMAGE_CLASSES.has(candidate) ? candidate : "unknown";
    return { classification, extraction: raw.slice(match[0].length).trim() || raw.trim() };
  }
  return { classification: "unknown", extraction: raw.trim() };
}

async function compileImage(
  meta: AttachmentMeta,
  session: { provider: string; model: string },
  signal: AbortSignal
): Promise<string> {
  const settings = await getSettings().catch(() => null);
  const maxBytes = (settings?.maxImageAttachmentMb ?? 10) * 1024 * 1024;
  if (meta.size > maxBytes) {
    const limitMb = settings?.maxImageAttachmentMb ?? 10;
    return imageUnavailableBlock(
      meta.id,
      meta.name,
      `image ${(meta.size / (1024 * 1024)).toFixed(1)}MB exceeds the ${limitMb}MB limit; content unavailable`
    );
  }

  const model = await visionModelPicker(session).catch(() => null);
  if (!model) {
    return imageUnavailableBlock(meta.id, meta.name, "image attached but no vision-capable provider is configured; content unavailable");
  }

  try {
    const raw = await visionSidecar(meta, model, signal);
    const { classification, extraction } = parseVisionOutput(raw);
    return imageBlock(meta.id, meta.name, classification, extraction);
  } catch (error) {
    logError("agent", "attachment vision sidecar failed", error, { attachmentId: meta.id });
    return imageUnavailableBlock(meta.id, meta.name, "image attached but description failed; content unavailable");
  }
}

async function compileOne(
  id: string,
  session: { provider: string; model: string },
  signal: AbortSignal
): Promise<string | null> {
  const meta = getAttachment(id);
  if (!meta) return null; // unknown/deleted id: skip silently

  if (isTextLike(meta)) return compileText(meta);
  if (meta.type.toLowerCase().startsWith("image/")) return compileImage(meta, session, signal);
  return binaryBlock(meta);
}

/**
 * Compile each attachment into a model-legible <attachment> text block.
 *
 * - Parallel, with a hard per-attachment timeout.
 * - Never throws and never rejects: a failing/slow attachment degrades to a
 *   fidelity="none" fallback so it can never block the turn.
 * - Unknown IDs are skipped silently.
 *
 * `opts.provider`/`opts.model` are the session's active provider/model. The
 * vision sidecar targets them first (when authed and image-capable) before
 * falling back to a cheap image-capable model on any authed provider.
 */
export async function compileAttachments(
  ids: string[],
  opts: { provider: string; model: string }
): Promise<CompiledArtifact[]> {
  if (!ids || ids.length === 0) return [];

  const settled = await Promise.allSettled(
    ids.map(async (id) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ATTACHMENT_TIMEOUT_MS);
      try {
        const block = await Promise.race([
          compileOne(id, opts, controller.signal),
          new Promise<string | null>((_resolve, reject) => {
            controller.signal.addEventListener("abort", () => reject(new Error("attachment compile timed out")));
          })
        ]);
        return block === null ? null : { id, block };
      } finally {
        clearTimeout(timer);
      }
    })
  );

  const artifacts: CompiledArtifact[] = [];
  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    if (outcome.status === "fulfilled") {
      if (outcome.value) artifacts.push(outcome.value);
      continue;
    }
    // Timeout or unexpected throw: emit a fidelity="none" fallback so the agent
    // still sees that a file was attached. Never fail the turn.
    const id = ids[i];
    const meta = getAttachment(id);
    const name = meta?.name ?? id;
    logError("agent", "attachment compile failed", outcome.reason, { attachmentId: id });
    artifacts.push({
      id,
      block: [
        `<attachment id="${escapeAttr(id)}" name="${escapeAttr(name)}" kind="unknown" fidelity="none">`,
        `[attachment could not be compiled in time; content unavailable]`,
        `</attachment>`
      ].join("\n")
    });
  }
  return artifacts;
}

/** One-line preamble prepended when attachments are present. */
export const ATTACHMENT_PREAMBLE =
  'The user attached the following files, compiled to text below. fidelity="approx" means the extraction may be lossy.';
