# Agent Integration Status

Last updated: 2026-04-29

## Current truth

- All server agent routes are stubs right now:
  - `POST /api/agent/sessions`
  - `POST /api/agent/sessions/:id/send`
  - `GET /api/agent/sessions/:id/stream`
  - `DELETE /api/agent/sessions/:id/turn`
  - `DELETE /api/agent/sessions/:id`
- They return `501 not implemented`.

So there is no real runtime process orchestration, no SSE event stream, and no persisted turn log yet.

## What already exists in shared contracts

`shared/src/events` exports event shape modules:

- `events/opencode.ts`
- `events/agent.ts`

These are contract scaffolds and can be used when implementing the runtime, but they are not currently wired to live backend routes.

## Expected integration path

When implemented, agent flow should be:

1. Create or select a session
2. Send prompt (+ optional diff context)
3. Spawn `opencode` process in project cwd
4. Parse stdout event stream
5. Emit normalized events over SSE
6. Persist events under repo-local `.glib/` session storage

## Blocking gaps

- Session lifecycle endpoints are mostly placeholders (`/api/sessions`).
- Attachments endpoints are placeholders (`/api/attachments`).
- Terminal transport is placeholder (`/api/term`).

Until those land, the session UI remains mostly a shell around local state.
