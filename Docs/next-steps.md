# Next Steps

Last updated: 2026-05-10

## Current shipped local loop

- Open/clone a local git repo.
- Review uncommitted or commit diffs without a provider key.
- Add provider API keys explicitly inside glib-code.
- Start pi-backed agent sessions in GitTrix ephemeral workspaces pre-hydrated from the durable repo.
- Stream user/assistant/error/tool-call timeline events over SSE.
- Keep session send/stream/abort actions scoped to server-owned `sessionId` metadata so reloads, project switches, and other tabs do not strand valid sessions.
- Preserve streamed assistant text chunks with collision-proof event IDs.
- Review session diffs and promote selected files back to the durable repo.

## Immediate priority order

1. Sandbox + pi RPC runtime parity.
2. Server consolidation: session domain service and state-store split follow-through.
3. Terminal WebSocket transport (`/api/term`).
4. Attachments API + frontend integration (`/api/attachments`).
5. Git mutation route completion under `/api/git`.
6. Hunk-level context/promote selection.
7. Reliability pass: route tests, restart behavior, multi-tab behavior, and dev/Electron parity.
8. GitTrix provider credential UX inside Settings cards (GitHub connect + Cloudflare inputs).

## Completed recently

- Made sandbox/RPC runtime the default; in-process SDK remains available with `GLIB_PI_RUNTIME=sdk` as a temporary fallback.
- Wired provider/model discovery and provider key management through `/api/providers`.
- Moved provider key storage to glib-owned app config (`<configDir>/pi/auth.json`).
- Stopped reading opencode auth storage.
- Added GitTrix local, GitHub durable, and Cloudflare Artifacts ephemeral session start/diff/promote/evict wiring.
- Hydrated sessions from backend state and replayed persisted timelines.
- Wired prompt send, SSE streaming, and abort routes.
- Added compact tool-call cards in the timeline.
- Added session diff/promote modal with file-level selection and baseline conflict handling.
- Reworked Settings → Models and ModelPicker around active model + usable provider auth.
- Kept Picker/project open/diff review available without provider keys.
- Added explicit GitTrix startup errors and Cloudflare config preflight errors.
- Added GitTrix quick fallback to Local durable/local ephemeral when provider setup fails.
- Hydrated GitTrix ephemeral workspace from durable repo on session start.
- Added README app screenshot.
- Added `bun run dev:desktop` for server + Vite + Electron local desktop development.
- Added strict Vite port handling and visible Electron startup/error logging for desktop dev.
- Fixed same-millisecond streamed text chunk collisions that could drop words from assistant responses.
- Added session-id routing and app-level session indexing for agent send/stream/abort/delete so valid sessions do not 404 after global project changes.
- Split server app state into focused settings and project stores.
- Added frontend guards against duplicate session creation and stale session EventSource streams.

## 1) Sandbox + pi RPC runtime

- Confirm exact pi RPC CLI flags and abort command/event schema.
- Finish local RPC parity for create/send/stream/abort/delete.
- Keep frontend `AgentEvent` contract untouched.
- Keep GitTrix storage/promote interfaces untouched.

## 2) Terminal WS

- Replace placeholder terminal transport with real `/api/term` websocket lifecycle.
- Add reconnect handling and explicit disconnected state in UI.
- Route terminal cwd through the active project or active GitTrix ephemeral workspace depending on context.

## 3) Attachments

- Implement upload/read/delete backend routes.
- Wire composer attachment selection + send payload.
- Decide persistence boundary for attachments: repo-local `.glib`, config dir, or session-scoped workspace.

## 4) Git mutations

- Complete missing stage/unstage/discard/commit/push/pull/checkout endpoints.
- Align frontend command actions to real route behavior.
- Ensure destructive actions have explicit confirmation/error surfaces.

## 5) Hunk-level context/promote

- Extend diff selection from file-level to hunk-level.
- Reuse the same selection primitive for context packing and session promote selectors.
- Keep file-level promote as the fallback for large or unsupported patches.

## 6) Reliability pass

- Standardize error payloads across route groups.
- Add integration-level route tests for provider auth, session create/send/stream, diff, and promote.
- Add multi-tab and reload regression coverage for session-id-scoped actions.
- Validate behavior across both hosts: Vite dev web and Electron shell.
- Add restart/recovery checks for session metadata, timeline persistence, and GitTrix workspace mapping.

## 7) Cloudflare Artifacts adapter

- Harden Cloudflare Artifacts error UX around missing account/token environment.
- Add hosted browser OAuth for GitHub instead of relying on local `gh`/token auth.
