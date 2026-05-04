# Next Steps

Last updated: 2026-05-04

## Current shipped local loop

- Open/clone a local git repo.
- Review uncommitted or commit diffs without a provider key.
- Add provider API keys explicitly inside glib-code.
- Start pi-backed agent sessions in GitTrix local ephemeral workspaces.
- Stream user/assistant/error/tool-call timeline events over SSE.
- Review session diffs and promote selected files back to the durable repo.

## Immediate priority order

1. Terminal WebSocket transport (`/api/term`).
2. Attachments API + frontend integration (`/api/attachments`).
3. Git mutation route completion under `/api/git`.
4. Hunk-level context/promote selection.
5. Reliability pass: structured errors, route tests, restart behavior, and dev/Electron parity.
6. Cloudflare Artifacts adapter once backend support lands.

## Completed recently

- Migrated agent runtime to `@mariozechner/pi-coding-agent` in-process.
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
- Added README app screenshot.
- Added `bun run dev:desktop` for server + Vite + Electron local desktop development.
- Added strict Vite port handling and visible Electron startup/error logging for desktop dev.

## 1) Terminal WS

- Replace placeholder terminal transport with real `/api/term` websocket lifecycle.
- Add reconnect handling and explicit disconnected state in UI.
- Route terminal cwd through the active project or active GitTrix ephemeral workspace depending on context.

## 2) Attachments

- Implement upload/read/delete backend routes.
- Wire composer attachment selection + send payload.
- Decide persistence boundary for attachments: repo-local `.glib`, config dir, or session-scoped workspace.

## 3) Git mutations

- Complete missing stage/unstage/discard/commit/push/pull/checkout endpoints.
- Align frontend command actions to real route behavior.
- Ensure destructive actions have explicit confirmation/error surfaces.

## 4) Hunk-level context/promote

- Extend diff selection from file-level to hunk-level.
- Reuse the same selection primitive for context packing and session promote selectors.
- Keep file-level promote as the fallback for large or unsupported patches.

## 5) Reliability pass

- Standardize error payloads across route groups.
- Add integration-level route tests for provider auth, session create/send/stream, diff, and promote.
- Validate behavior across both hosts: Vite dev web and Electron shell.
- Add restart/recovery checks for session metadata, timeline persistence, and GitTrix workspace mapping.

## 6) Cloudflare Artifacts adapter

- Harden Cloudflare Artifacts error UX around missing account/token environment.
- Add hosted browser OAuth for GitHub instead of relying on local `gh`/token auth.
