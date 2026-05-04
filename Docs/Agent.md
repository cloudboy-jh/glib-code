# Agent Integration

Last updated: 2026-05-03

## Runtime model

- Agent runtime uses `@mariozechner/pi-coding-agent` as an in-process library.
- No subprocess spawn and no NDJSON/stdout parser layer.
- Backend normalizes pi events into shared `AgentEvent` shape and streams them via SSE.
- Assistant provider/runtime errors from pi are surfaced as canonical `error` events instead of empty assistant messages.
- Tool execution events are preserved as structured timeline tool calls.

## Session isolation model

- Each glib session is paired with a GitTrix session.
- Agent turns run with cwd set to the session-specific GitTrix ephemeral workspace.
- Agent writes land in ephemeral workspace, not the user’s durable repo.
- Accepted changes are moved to durable only through explicit promote.

## Session persistence

- Session metadata and event timeline are persisted under repo-local `.glib/sessions`.
- `SessionMeta` includes GitTrix mapping fields (`gittrixSessionId`, `ephemeralPath`, `baselineSha`).

## Provider/model authority

- pi is source of truth for provider auth and model discovery.
- Session create/send validates provider/model against current pi capability state.
- glib stores in-app provider API keys under `<configDir>/pi/auth.json`.
- glib does not read opencode or other app auth files.
- Unsupported OAuth credential records do not count as usable provider auth.

## Key flow

1. User adds a key in Picker or Settings → Models.
2. Frontend calls `POST /api/providers/:id/auth`.
3. Backend writes `{ type: "api_key", key }` to glib's pi auth file.
4. `ModelRegistry.refresh()` updates provider/model capability state.
5. Agent session create/send validates selected provider/model before running pi.

## Active gaps

- Attachments transport/API parity (`/api/attachments`).
- Terminal transport parity (`/api/term` WebSocket).
- Remaining git mutation parity endpoints under `/api/git`.
- Hunk-level context/promote selection.
