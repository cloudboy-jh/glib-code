# Backend Checklist

Last updated: 2026-05-02

## Core route completion

- [x] Implement `/api/agent/*` route group (create/send/stream/abort/delete).
- [x] Implement `/api/sessions/*` route group (list/read/fork/delete/patch).
- [x] Implement `/api/sessions/:id/diff`.
- [x] Implement `/api/sessions/:id/promote`.
- [x] Implement `/api/sessions/:id/evict`.
- [ ] Implement `/api/term` WebSocket transport.
- [ ] Implement `/api/attachments` upload/read/delete routes.
- [ ] Implement git mutation routes under `/api/git` (stage/commit/push/etc).
- [ ] Implement `/api/diff/branch-compare`.

## Agent runtime

- [x] Replace subprocess runtime with pi in-process runtime.
- [x] Add SSE event fanout for active session streams.
- [ ] Normalize and validate event payloads against shared contracts.
- [ ] Add clean abort/timeout handling per turn.

## Session persistence

- [x] Store session metadata and timeline events in repo-local `.glib/`.
- [ ] Implement list/read/fork/delete semantics.
- [ ] Ensure project switching does not cross-contaminate session data.

## Provider/model authority

- [x] Use pi discovery as source of truth for provider/model availability.
- [x] Expose discovery-backed `/api/providers`.
- [x] Add provider auth key routes (`POST/DELETE /api/providers/:id/auth`).
- [x] Validate provider/model defaults and project overrides against discovered capabilities.
- [x] Validate session create/send against discovered capabilities.
- [x] Remove backend static provider/model catalogs.

## State and safety

- [ ] Move current project state to a client/session scoped model (not single process-global value).
- [ ] Harden FS read/tree for large repos and binary files.
- [ ] Add consistent error envelopes for route failures.

## Readiness/auth

- [ ] Keep readiness checks fast and cached while preserving actionable errors.
- [ ] Either implement auth endpoints or mark them explicitly local-only in API contract.

## Definition of done (backend)

- [x] Agent routes run real turns with streaming.
- [ ] Sessions persist and replay across server restarts.
- [ ] Git and diff route surface matches what frontend advertises.
- [ ] Typecheck + build pass (`bun run --cwd server check`, `bun run --cwd server build`).
