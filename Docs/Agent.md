# Agent Integration

Last updated: 2026-05-02

## Runtime model

- Agent runtime uses `@mariozechner/pi-coding-agent` as an in-process library.
- No subprocess spawn and no NDJSON/stdout parser layer.
- Backend normalizes pi events into shared `AgentEvent` shape and streams them via SSE.

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

## Active gaps

- Attachments transport/API parity (`/api/attachments`).
- Terminal transport parity (`/api/term` WebSocket).
- Remaining git mutation parity endpoints under `/api/git`.
