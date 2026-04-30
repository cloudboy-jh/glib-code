# Agent Integration Status

Last updated: 2026-04-30

## Current truth

- Server agent routes now exist for create/send/stream/abort/delete.
- Runtime spawns opencode subprocess turns and emits normalized events to SSE.
- Session events are persisted under repo-local `.glib/sessions`.

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

## Provider/model authority

- Provider/model availability and auth status are opencode-owned.
- Session create and send validate against opencode-discovered capabilities.
- Session stores provider/model snapshot at creation; send re-validates current availability.

## Blocking gaps

- Attachments endpoints are placeholders (`/api/attachments`).
- Terminal transport is placeholder (`/api/term`).
- GitTrix `session.write/promote/evict` service boundary wiring still needs landing.
