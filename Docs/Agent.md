# glib-code — agent.md

> The wire between opencode, the server, and the frontend timeline. Every event shape, every transformation, every state transition.

Scope: how a user prompt becomes a spawned opencode process, how raw JSONL from opencode becomes `AgentEvent`s on the SSE stream, and how the frontend turns those events into `TimelineEntry`s rendered in Session mode. No UI or backend architecture decisions here — those live in `frontend.md` and `backend.md`.

---

## The pipeline

```
User sends prompt
       │
       ▼
POST /api/agent/sessions/:id/send
       │
       ▼
opencode.service spawns:
  opencode run --format json <prompt>
  (cwd = project path, stdin closed, stdout piped)
       │
       ▼
Bun.spawn → async-iterable over stdout lines
       │
       ▼  (one JSON object per line — OpencodeEvent)
       │
       ▼
Transform stage:
  OpencodeEvent → AgentEvent
  (one-to-one, one-to-many, or one-to-zero)
       │
       ├──► Write to <repo>/.glib/sessions/<id>.jsonl (persist)
       │
       └──► Write to SSE stream (live)
                   │
                   ▼
       Frontend EventSource onmessage
                   │
                   ▼
  useAgent composable reducer:
    AgentEvent → TimelineEntry[] (mutate)
                   │
                   ▼
         Timeline component re-renders
```

Every arrow in that diagram corresponds to a section below.

---

## Opencode events (the input)

opencode writes NDJSON to stdout. One line, one event. Five types total, documented against the v1 schema.

```ts
// shared/src/events/opencode.ts
type OpencodeEvent =
  | StepStart
  | ToolUse
  | Text
  | StepFinish
  | ErrorEvent;
```

### `step_start`

Marks the beginning of a processing step. Usually one at the top of the response, often more before each tool-calls cycle.

```ts
{
  type: "step_start";
  timestamp: number;           // ms
  sessionID: string;           // "ses_XXX"
  part: {
    id: string;                // "prt_XXX"
    sessionID: string;
    messageID: string;         // "msg_XXX"
    type: "step-start";
    snapshot: string;          // git hash at step start
  };
}
```

### `tool_use`

Tool invocation. **Only fires when the tool has already finished** (`status == "completed"`). The CLI does not emit pending/running states — there's no "tool started, tool streaming, tool done" sequence, just a single terminal event per call.

```ts
{
  type: "tool_use";
  timestamp: number;
  sessionID: string;
  part: {
    id: string;
    sessionID: string;
    messageID: string;
    type: "tool";
    callID: string;            // unique per invocation
    tool: string;              // "bash" | "read" | "write" | "edit" | "grep" | "glob" | "webfetch" | "websearch" | "task"
    state: {
      status: "completed";
      input: object;           // tool-specific args
      output: string;          // tool result text
      title: string;           // human-readable label
      metadata: object;        // exit codes, etc.
      time: { start: number; end: number };
    };
  };
}
```

### `text`

A complete text "part" from the model. **Not a token delta.** Each event carries the full text of one part. Multi-part responses produce multiple `text` events, each whole.

```ts
{
  type: "text";
  timestamp: number;
  sessionID: string;
  part: {
    id: string;
    sessionID: string;
    messageID: string;
    type: "text";
    text: string;              // the complete part text
    time: { start: number; end: number };
  };
}
```

This has implications for the frontend — see *"Streaming text without deltas"* below.

### `step_finish`

Marks the end of a processing step. The `reason` distinguishes final completion from continuation.

```ts
{
  type: "step_finish";
  timestamp: number;
  sessionID: string;
  part: {
    id: string;
    sessionID: string;
    messageID: string;
    type: "step-finish";
    reason?: "stop" | "tool-calls";
    snapshot: string;
    cost: number;              // USD
    tokens: {
      input: number;
      output: number;
      reasoning: number;
      cache: { read: number; write: number };
    };
  };
}
```

- `reason: "stop"` — final step, the model is done responding.
- `reason: "tool-calls"` — the model invoked tools; another step cycle will follow.
- Missing `reason` + clean process exit — treat as successful completion (same as `"stop"`).

### `error`

Session error. Terminates the turn.

```ts
{
  type: "error";
  timestamp: number;
  sessionID: string;
  error: {
    name: string;              // "APIError" | ...
    data?: {
      message?: string;
      statusCode?: number;
      isRetryable?: boolean;
    };
  };
}
```

---

## AgentEvent (the wire format)

The server does not forward raw `OpencodeEvent`s to the frontend. It transforms them into a glib-native `AgentEvent` shape that's friendlier for the frontend and also captures glib-specific concerns (user turns, context attachments, session lifecycle) that opencode doesn't emit.

```ts
// shared/src/events/agent.ts
type AgentEvent =
  // Emitted by glib, not opencode
  | { type: "session_start"; sessionId: string; projectId: string; branch: string; model: string; createdAt: string }
  | { type: "user_turn"; turnId: string; prompt: string; context?: string; attachments?: string[]; at: string }
  | { type: "turn_start"; turnId: string; at: string }
  | { type: "turn_end"; turnId: string; reason: "stop" | "aborted" | "error"; at: string; cost?: number; tokens?: TokenUsage }
  | { type: "aborted"; turnId: string; at: string }

  // Derived from opencode events
  | { type: "step_start"; turnId: string; stepId: string; snapshot: string; at: string }
  | { type: "text_part"; turnId: string; stepId: string; partId: string; text: string; at: string }
  | { type: "tool_call"; turnId: string; stepId: string; callId: string; tool: ToolName; title: string; input: object; output: string; metadata: object; durationMs: number; at: string }
  | { type: "step_end"; turnId: string; stepId: string; reason?: "stop" | "tool-calls"; cost: number; tokens: TokenUsage; at: string }
  | { type: "error"; turnId: string; name: string; message?: string; retryable?: boolean; at: string };

type ToolName = "bash" | "read" | "write" | "edit" | "grep" | "glob" | "webfetch" | "websearch" | "task" | string;
type TokenUsage = { input: number; output: number; reasoning: number; cacheRead: number; cacheWrite: number };
```

### Why transform at all

1. **Glib owns its own session/turn concepts.** opencode runs know nothing about glib's session IDs or the `user_turn` event. The server has to inject these.
2. **Normalized timestamps.** opencode emits Unix-ms numbers; glib standardizes on ISO strings.
3. **Flatter shape.** The `part` nesting in opencode events is noise for the frontend.
4. **Deterministic turnId.** Every downstream event in a turn gets the same `turnId`, so the reducer can group without tracking opencode's `messageID`s.
5. **Opencode-agnostic future.** If glib ever supports another backend (claude-code, pi), the `AgentEvent` shape doesn't change — only the transform does.

---

## Transform rules

The opencode service runs each stdout line through `transformOpencodeEvent(line, ctx)` where `ctx` holds `turnId`, `sessionId`, and a stepId cache. The function returns `AgentEvent[]` (zero, one, or many).

| opencode event | emits |
|---|---|
| `step_start` | `step_start { turnId, stepId: part.id, snapshot: part.snapshot, at }` |
| `tool_use` | `tool_call { turnId, stepId: <current>, callId: part.callID, tool: part.tool, title: part.state.title, input: part.state.input, output: part.state.output, metadata: part.state.metadata, durationMs: end-start, at }` |
| `text` | `text_part { turnId, stepId: <current>, partId: part.id, text: part.text, at }` |
| `step_finish` | `step_end { turnId, stepId: part.id, reason: part.reason, cost: part.cost, tokens: remap(part.tokens), at }` |
| `error` | `error { turnId, name: error.name, message: error.data?.message, retryable: error.data?.isRetryable, at }` |

Additionally, the server emits lifecycle events that have no opencode counterpart:

| When | Server emits |
|---|---|
| First byte on the SSE connection for a new session | `session_start` (populated from session metadata) |
| Before spawning opencode for a send | `user_turn` (capturing the prompt, context, attachments) |
| Immediately after spawn succeeds | `turn_start` |
| After the last `step_finish` with `reason: "stop"` (or process exit with no `reason`) | `turn_end { reason: "stop" }` |
| After an `error` event terminates the turn | `turn_end { reason: "error" }` |
| After a `DELETE /api/agent/sessions/:id/turn` abort | `aborted` then `turn_end { reason: "aborted" }` |

### The current-stepId rule

opencode doesn't repeat the stepId on every event within a step — only `step_start` announces it. The transform holds the most recent `step_start.part.id` in `ctx.currentStepId` and attaches it to every `text_part` and `tool_call` that follows until the next `step_start` or `step_end`.

If a `text` or `tool_use` event arrives before any `step_start` (shouldn't happen per spec, but defensive), the transform assigns a synthesized `stepId` like `step-synthetic-<ulid>`.

---

## Persistence shape

The JSONL file at `<repo>/.glib/sessions/<sessionId>.jsonl` stores the exact same `AgentEvent` shape that goes over the SSE wire. No separate persistence schema.

This gives us three properties for free:

1. **Replay.** `GET /api/agent/sessions/:id/stream?since=<lastEventId>` reads the JSONL from the given event forward, then switches to live.
2. **Portability.** `jq` works. Users can inspect their own transcripts with standard tools.
3. **Forking.** `POST /api/agent/sessions/:id/fork` copies the JSONL up to the requested turnId into a new file and returns the new session ID. No schema translation.

First line is always `session_start`. Subsequent entries are `user_turn` followed by the transformed stream for that turn, terminated by `turn_end`. Repeat per turn.

---

## Frontend: TimelineEntry

The frontend's `useAgent` composable holds an array of `TimelineEntry` per session. Each entry is one visible block in the Timeline component.

```ts
// web/src/types/timeline.ts
type TimelineEntry =
  | UserMessageEntry
  | ContextBlockEntry
  | AssistantMessageEntry
  | WorkLogEntry
  | ErrorEntry;

type UserMessageEntry = {
  kind: "user-message";
  turnId: string;
  text: string;
  attachments?: AttachmentRef[];
  at: string;
};

type ContextBlockEntry = {
  kind: "context-block";
  turnId: string;
  diff: string;             // raw unified diff
  stats: DiffStats;
  at: string;
};

type AssistantMessageEntry = {
  kind: "assistant-message";
  turnId: string;
  stepIds: string[];        // one message may span steps
  parts: TextPart[];        // concatenated from text_part events
  streaming: boolean;       // true until turn_end or next user_turn
  at: string;               // first part's timestamp
};

type TextPart = {
  partId: string;
  text: string;
};

type WorkLogEntry = {
  kind: "work-log";
  turnId: string;
  stepId: string;
  calls: ToolCall[];        // grouped tool_calls within one step
  collapsed: boolean;       // UI state, defaults true
  at: string;               // first call's timestamp
};

type ToolCall = {
  callId: string;
  tool: ToolName;
  title: string;
  input: object;
  output: string;
  metadata: object;
  durationMs: number;
  // Rendered specially when tool is "write" or "edit" — see below
};

type ErrorEntry = {
  kind: "error";
  turnId: string;
  name: string;
  message?: string;
  retryable?: boolean;
  at: string;
};
```

---

## Reducer: AgentEvent → TimelineEntry[]

Pseudocode for the core reduction. Runs in `useAgent` on each incoming event.

```ts
function reduce(entries: TimelineEntry[], event: AgentEvent): TimelineEntry[] {
  switch (event.type) {
    case "session_start":
      // No-op for timeline; sets session metadata elsewhere
      return entries;

    case "user_turn": {
      const next = [...entries];
      if (event.context) {
        next.push({
          kind: "context-block",
          turnId: event.turnId,
          diff: event.context,
          stats: computeStats(event.context),
          at: event.at,
        });
      }
      next.push({
        kind: "user-message",
        turnId: event.turnId,
        text: event.prompt,
        attachments: resolveAttachments(event.attachments),
        at: event.at,
      });
      return next;
    }

    case "turn_start":
      return entries;  // nothing visual yet

    case "step_start":
      return entries;  // nothing visual until text or tool appears

    case "text_part": {
      // Append to the current assistant message for this turn, or create one
      const last = entries[entries.length - 1];
      if (last?.kind === "assistant-message" && last.turnId === event.turnId) {
        return replaceLast(entries, {
          ...last,
          parts: [...last.parts, { partId: event.partId, text: event.text }],
          stepIds: last.stepIds.includes(event.stepId) ? last.stepIds : [...last.stepIds, event.stepId],
        });
      }
      return [...entries, {
        kind: "assistant-message",
        turnId: event.turnId,
        stepIds: [event.stepId],
        parts: [{ partId: event.partId, text: event.text }],
        streaming: true,
        at: event.at,
      }];
    }

    case "tool_call": {
      // Group with existing work-log for this step, or create one
      const existing = entries.findLast(
        (e) => e.kind === "work-log" && e.stepId === event.stepId,
      );
      if (existing) {
        return replaceEntry(entries, existing, {
          ...existing,
          calls: [...existing.calls, toToolCall(event)],
        });
      }
      return [...entries, {
        kind: "work-log",
        turnId: event.turnId,
        stepId: event.stepId,
        calls: [toToolCall(event)],
        collapsed: true,
        at: event.at,
      }];
    }

    case "step_end":
      return entries;  // bookkeeping only

    case "turn_end": {
      // Mark any streaming assistant-message for this turn as done
      return entries.map((e) =>
        e.kind === "assistant-message" && e.turnId === event.turnId && e.streaming
          ? { ...e, streaming: false }
          : e
      );
    }

    case "aborted":
      // Add a compact badge; could be rendered as a synthetic entry or via a per-turn flag
      return entries;  // flag handled outside the timeline array

    case "error":
      return [...entries, {
        kind: "error",
        turnId: event.turnId,
        name: event.name,
        message: event.message,
        retryable: event.retryable,
        at: event.at,
      }];
  }
}
```

---

## Streaming text without deltas

opencode emits whole text parts, not token deltas. This matters for perceived responsiveness.

Two options for v1:

**A. Render as parts arrive (pick this).** When a `text_part` arrives, show it immediately. A multi-part response feels like "chunks of text appearing" — not character-by-character, but each chunk is fast enough to feel alive. opencode typically emits one part per model turn-section, so the cadence is on the order of seconds between parts, not instant.

**B. Simulate a type-on effect.** Locally animate the characters of each received part at a high rate (e.g., 60fps × N chars). Fakes the Claude Code feel, at the cost of divergence between displayed and actual text.

v1 ships option A. It's honest, and it's what the schema gives us. If the cadence feels too chunky at launch, option B is a drop-in enhancement inside `AssistantMessageEntry.parts` rendering — no schema change.

---

## Write/edit tool special rendering

When a `tool_call.tool` is `"write"` or `"edit"`, the `WorkLogEntry` renders an inline `DiffView` (`@pierre/diffs`) for that call instead of just the raw output text.

The diff is reconstructed at render time from:

- `tool_call.input.path` — the file path
- `tool_call.input.content` (write) or `tool_call.input.old_string` + `tool_call.input.new_string` (edit) — the change
- The prior file contents are not in the event; for `edit`, the `old_string`/`new_string` pair is enough to render a minimal diff. For `write` against a new file, show as all-additions. For `write` against an existing file, show the new content without a diff (we don't have the old content in-stream, and fetching it asynchronously would complicate the reducer).

This is the one place the frontend touches `@pierre/diffs` outside Diff mode itself. Component: `InlineDiff`, same as listed in `frontend.md`.

---

## Abort protocol

`DELETE /api/agent/sessions/:id/turn` triggers:

1. Server sends SIGTERM to the active opencode child for this session.
2. Server writes `{"type":"aborted","turnId":...}` to the JSONL and SSE stream.
3. Server writes `{"type":"turn_end","turnId":...,"reason":"aborted"}`.
4. Child process's remaining stdout (if any) is discarded.

The frontend shows an "aborted" badge on the turn (muted italic "aborted"). No partial output is removed — whatever was streamed before the abort stays visible in the timeline.

---

## Reconnect protocol

`EventSource` disconnects are handled by passing the last received event's timestamp (or a monotonic event index maintained server-side) as `?since=<marker>`.

1. Server opens the session's JSONL file.
2. Seeks to the first event with `at > since` (or `index > since`).
3. Writes all subsequent events as SSE messages back-to-back.
4. When caught up to live, switches to forwarding live events from the active transform.

The frontend doesn't need to dedupe — the marker is exclusive. It just runs the reducer against every event it receives, same path as first-time load.

---

## What opencode does NOT give us

Flagged so nobody builds against a false assumption:

- **No per-token streaming.** `text_part` is whole parts.
- **No tool start/running events.** `tool_use` only when `completed`. A bash command running for 60 seconds shows nothing, then everything at once.
- **No plan / proposed-plan events.** t3code has these; opencode doesn't emit them. `TimelineEntry` has no `proposed-plan` kind in v1 as a result.
- **No approval/permission prompts.** opencode config controls permissions at launch (`edit: ask | allow | deny`). If set to `ask`, opencode goes interactive — incompatible with `--format json`. glib-code ships with `allow` or `deny` only; documented in settings.
- **No file reference resolution.** `@foo.ts` in the prompt is just text; opencode doesn't do mention resolution. The composer can optionally expand `@file` refs to file contents before sending, but that's a frontend concern, not an opencode feature.

---

## Out of scope (v1)

- Real-time tool progress (bash streaming, read-in-chunks) — not possible without opencode CLI changes.
- Proposed-plan timeline entries.
- Subagent task visualization (the `task` tool spawns sub-agents; v1 renders their `tool_call` like any other tool without inner stream).
- Cost/token HUD — data is there in `step_end`, but v1 doesn't surface it visually.
- Session resume after glib restart with the opencode-side session ID (opencode's `-c <session-id>` flag). v1 restarts opencode fresh per turn.