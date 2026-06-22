import type { AgentEvent } from "@glib-code/shared/events/agent";
import type { SessionMeta } from "./session-store";

export type SessionExportFormat = "json" | "jsonl" | "markdown" | "pi-jsonl";

type SessionDoc = {
  meta: SessionMeta;
  events: AgentEvent[];
};

type ExportResult = {
  body: string;
  contentType: string;
  filename: string;
};

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "session";
}

function jsonl(lines: unknown[]) {
  return `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`;
}

function eventTime(event: AgentEvent) {
  return "at" in event ? event.at : event.type === "session_start" ? event.createdAt : new Date().toISOString();
}

function eventTurn(event: AgentEvent) {
  return "turnId" in event ? event.turnId : undefined;
}

function entryId(sessionId: string, index: number, kind: string) {
  return `${sessionId}_${kind}_${String(index).padStart(6, "0")}`;
}

function textFromParts(parts: string[]) {
  return parts.join("").trim();
}

function renderMarkdown(doc: SessionDoc) {
  const lines = [
    `# ${doc.meta.title || doc.meta.id}`,
    "",
    `- Session: ${doc.meta.id}`,
    `- Project: ${doc.meta.projectPath}`,
    `- Provider/model: ${doc.meta.provider}/${doc.meta.model}`,
    `- Created: ${doc.meta.createdAt}`,
    `- Updated: ${doc.meta.updatedAt}`,
    ""
  ];

  let currentAssistant: string[] = [];
  const flushAssistant = () => {
    const text = textFromParts(currentAssistant);
    if (text) lines.push("## Assistant", "", text, "");
    currentAssistant = [];
  };

  for (const event of doc.events) {
    if (event.type === "user_turn") {
      flushAssistant();
      lines.push("## User", "", event.prompt, "");
      if (event.context?.trim()) lines.push("### Context", "", event.context.trim(), "");
    } else if (event.type === "text_part") {
      currentAssistant.push(event.text);
    } else if (event.type === "tool_call") {
      flushAssistant();
      lines.push(`### Tool: ${event.tool}`, "", `**${event.title || event.tool}**`, "", "```json", JSON.stringify(event.input, null, 2), "```", "", "```", event.output || "", "```", "");
      if (event.resultType === "tree" && event.artifact?.tree?.paths?.length) {
        lines.push("", `<details><summary>${event.artifact.tree.paths.length} paths</summary>`, "", "```", event.artifact.tree.paths.join("\n"), "```", "", "</details>", "");
      } else if (event.resultType === "diff" && event.artifact?.patch) {
        lines.push("", "```diff", event.artifact.patch, "```", "");
      }
    } else if (event.type === "error") {
      flushAssistant();
      lines.push("## Error", "", event.message || event.name, "");
    }
  }
  flushAssistant();
  return `${lines.join("\n").replace(/\n{4,}/g, "\n\n\n").trimEnd()}\n`;
}

function renderPiJsonl(doc: SessionDoc) {
  const lines: unknown[] = [
    {
      type: "session",
      version: 3,
      id: doc.meta.id,
      timestamp: doc.meta.createdAt,
      cwd: doc.meta.projectPath
    }
  ];

  let parentId: string | null = null;
  let sequence = 0;
  const assistantTextByTurn = new Map<string, string[]>();

  const appendEntry = (timestamp: string, message: unknown, kind: string) => {
    const id = entryId(doc.meta.id, sequence++, kind);
    lines.push({ type: "message", id, parentId, timestamp, message });
    parentId = id;
  };

  const flushAssistant = (turnId: string, timestamp: string) => {
    const parts = assistantTextByTurn.get(turnId);
    const text = parts ? textFromParts(parts) : "";
    if (!text) return;
    appendEntry(timestamp, {
      role: "assistant",
      content: text,
      provider: doc.meta.provider,
      model: doc.meta.model
    }, "assistant");
    assistantTextByTurn.delete(turnId);
  };

  for (const event of doc.events) {
    const turnId = eventTurn(event);
    if (event.type === "user_turn") {
      appendEntry(event.at, { role: "user", content: event.prompt }, "user");
    } else if (event.type === "text_part") {
      const parts = assistantTextByTurn.get(event.turnId) ?? [];
      parts.push(event.text);
      assistantTextByTurn.set(event.turnId, parts);
    } else if (event.type === "tool_call") {
      flushAssistant(event.turnId, event.at);
      const callId = event.callId;
      appendEntry(event.at, {
        role: "assistant",
        content: [{ type: "toolCall", id: callId, name: event.tool, arguments: event.input }],
        provider: doc.meta.provider,
        model: doc.meta.model
      }, "tool_call");
      appendEntry(event.at, {
        role: "toolResult",
        toolCallId: callId,
        toolName: event.tool,
        content: event.output,
        details: event.metadata,
        resultType: event.resultType,
        artifact: event.artifact,
        isError: false
      }, "tool_result");
    } else if (event.type === "turn_end" && turnId) {
      flushAssistant(turnId, event.at);
    } else if (event.type === "error" && event.message) {
      appendEntry(event.at, { role: "assistant", content: event.message, provider: doc.meta.provider, model: doc.meta.model }, "error");
    }
  }

  for (const [turnId, parts] of assistantTextByTurn) {
    const last = [...doc.events].reverse().find((event) => eventTurn(event) === turnId);
    appendEntry(last ? eventTime(last) : doc.meta.updatedAt, { role: "assistant", content: textFromParts(parts), provider: doc.meta.provider, model: doc.meta.model }, "assistant");
  }

  return jsonl(lines);
}

export function exportSessionDoc(doc: SessionDoc, format: SessionExportFormat): ExportResult {
  const base = safeFilename(`${doc.meta.title || doc.meta.id}-${doc.meta.id}`);
  if (format === "json") {
    return {
      body: `${JSON.stringify(doc, null, 2)}\n`,
      contentType: "application/json; charset=utf-8",
      filename: `${base}.json`
    };
  }
  if (format === "jsonl") {
    return {
      body: jsonl(doc.events),
      contentType: "application/x-ndjson; charset=utf-8",
      filename: `${base}.jsonl`
    };
  }
  if (format === "markdown") {
    return {
      body: renderMarkdown(doc),
      contentType: "text/markdown; charset=utf-8",
      filename: `${base}.md`
    };
  }
  return {
    body: renderPiJsonl(doc),
    contentType: "application/x-ndjson; charset=utf-8",
    filename: `${base}.pi.jsonl`
  };
}

export function parseExportFormat(value: string | undefined): SessionExportFormat | null {
  if (!value || value === "json") return "json";
  if (value === "jsonl") return "jsonl";
  if (value === "md" || value === "markdown") return "markdown";
  if (value === "pi" || value === "pi-jsonl") return "pi-jsonl";
  return null;
}
