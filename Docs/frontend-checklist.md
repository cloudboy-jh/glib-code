# Frontend Checklist

Last updated: 2026-05-04

## API wiring cleanup

- [x] Replace hardcoded `API_BASE` with env-driven config.
- [x] Remove localStorage-backed mock session persistence from primary session flow.
- [x] Hydrate sessions from `/api/sessions`.
- [ ] Handle backend 404/501 states with explicit UI fallbacks (not silent failures).

## Provider/model capability UX

- [x] Consume dynamic provider/model capabilities from `/api/providers`.
- [x] Replace static settings model input with provider-scoped selectors.
- [x] Surface provider auth/capability failures with explicit UI messages.
- [ ] Add project-level provider/model override UX + effective state labels.

## Provider auth UX

- [x] In Settings → Models, show "Add API key" for unauthenticated providers.
- [x] Save provider key with `POST /api/providers/:id/auth` and refresh capability state.
- [x] Allow key removal with `DELETE /api/providers/:id/auth`.
- [x] Show OpenRouter onboarding banner when no providers are authenticated.
- [x] Add optional provider setup card in Picker.
- [x] Keep picker/project open/diff review usable without a provider key.

## Promote UX

- [x] Fetch and render `/api/sessions/:id/diff` via `@pierre/diffs`.
- [ ] Add hunk selection UI for promote selectors.
- [x] Add file selection UI for promote selectors.
- [x] Trigger `POST /api/sessions/:id/promote` from session UI.
- [x] Handle 409 baseline conflict response with dedicated modal/state.

## Diff → session context flow

- [ ] Expand diff selection from file-level to hunk-level context selection.
- [ ] Support multi-select aggregation before creating context packet.
- [ ] Keep context summary visible in composer before send.
- [ ] Preserve selected context when switching between Diff and Session mode.

## Session and streaming

- [x] Create sessions via `/api/agent/sessions`.
- [x] Send prompts via `/api/agent/sessions/:id/send`.
- [x] Stream events via `/api/agent/sessions/:id/stream`.
- [x] Reduce streamed events into timeline entries.
- [x] Render tool calls as compact expandable cards.
- [x] Implement abort action using `DELETE /api/agent/sessions/:id/turn`.

## Terminal and attachments

- [ ] Replace simulated terminal output with `/api/term` WS flow.
- [ ] Wire image/file uploads to `/api/attachments` endpoints once implemented.

## UX integrity

- [ ] Keep picker keyboard controls working with all dialog states.
- [ ] Ensure `Ctrl/Cmd+K`, `Ctrl/Cmd+J`, `Esc` precedence is deterministic.
- [ ] Ensure command palette actions are disabled when backend capability is missing.

## Picker home controls

- [x] Add home controls for Theme, GitTrix settings, and Model access.
- [x] Keep behavior parity between home quick controls and Settings modal.

## Definition of done (frontend)

- [ ] No critical workflow depends on mock-only data paths.
- [x] Diff review -> context attach -> prompt send -> streamed timeline works end-to-end.
- [x] Build and typecheck pass (`bun run --cwd web check`, `bun run --cwd web build`).
