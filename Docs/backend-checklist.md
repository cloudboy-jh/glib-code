# Backend Checklist — Gittrix as Primary Storage Router

Last updated: 2026-04-26

Goal: glib backend uses Gittrix for ephemeral agent workspaces and human-gated promotion into durable repos.

## A) Contract + boundaries

- [ ] Freeze glib↔gittrix boundary in one service (`server/src/services/gittrix.ts` or equivalent).
- [ ] Define typed response/error schema for `start/list/diff/log/promote` operations.
- [ ] Define durable-write policy: only promotion route can mutate durable repo.
- [ ] Define baseline conflict payload shape for frontend rendering.

## B) Session lifecycle integration

- [ ] Implement session start against Gittrix (`task title`, `repo path`, `base ref`).
- [ ] Persist session mapping (`glibSessionId` ↔ `gittrixSessionId`) in session metadata.
- [ ] Implement session list/read using Gittrix as source of truth.
- [ ] Implement session delete/evict path with clear lifecycle semantics.
- [ ] Implement session diff/log passthrough APIs for UI inspection.

## C) Agent execution path (ephemeral-only)

- [ ] Ensure opencode subprocess runs with cwd at Gittrix ephemeral workspace.
- [ ] Prevent agent routes from calling direct durable git mutations.
- [ ] Keep transcript write path (`.glib/sessions/*.jsonl`) while workspace storage is Gittrix-managed.
- [ ] Ensure abort/cleanup correctly handles active ephemeral workspace turns.

## D) Promotion flow (human-only)

- [ ] Add promotion endpoint (`POST /api/git/promote` or `/api/sessions/:id/promote`).
- [ ] Require explicit human action context (never auto-promote after turn end).
- [ ] Validate baseline before promote; return deterministic conflict details on mismatch.
- [ ] Support file-scoped promote and full-session promote.
- [ ] Return durable commit sha + promoted file stats on success.

## E) Existing route upgrades (current stubs)

- [ ] Replace `/api/agent/sessions` stubbed handlers (`501`) with real implementation.
- [ ] Replace `/api/sessions/*` placeholder handlers with real backing store behavior.
- [ ] Implement `/api/diff/branch-compare` instead of `501`.
- [ ] Ensure `/api/repo/*` resolves against active durable repo while session work happens ephemerally.

## F) Persistence + migration

- [ ] Keep existing local config files (`recents.json`, `settings.json`, `keybindings.json`) unchanged.
- [ ] Add migration path for any pre-Gittrix session metadata if format changed.
- [ ] Document on-disk ownership split: glib metadata vs Gittrix workspace/session state.
- [ ] Ensure `.glib/` remains gitignored and contains no accidental durable patch artifacts.

## G) Observability + failure handling

- [ ] Structured logs include `glibSessionId`, `gittrixSessionId`, and promote attempt id.
- [ ] Emit clear error classes for: missing session, stale baseline, promote conflict, gittrix unavailable.
- [ ] Add health/readiness checks for Gittrix availability/version.
- [ ] Return actionable error messages to frontend without leaking stack traces.

## H) Done criteria for backend Gittrix milestone

- [ ] End-to-end local flow succeeds: start session → agent edits ephemeral → promote → one durable commit.
- [ ] Verified: no backend route allows agent-originated direct durable write.
- [ ] Verified: stale baseline blocks promote with explicit conflict payload.
- [ ] Build/typecheck pass for server/shared, with route schema types aligned to frontend usage.
