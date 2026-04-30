# Frontend Checklist

Last updated: 2026-04-30

## API wiring cleanup

- [ ] Replace hardcoded `API_BASE` with env-driven config.
- [ ] Remove remaining local/mock session data in `App.vue`.
- [ ] Hydrate sessions from `/api/sessions` when backend routes are implemented.
- [ ] Handle backend 404/501 states with explicit UI fallbacks (not silent failures).

## Provider/model capability UX

- [x] Consume dynamic provider/model capabilities from `/api/providers`.
- [x] Replace static settings model input with provider-scoped selectors.
- [ ] Surface opencode auth/capability failures with explicit UI messages.
- [ ] Add project-level provider/model override UX + effective state labels.

## Diff → session context flow

- [ ] Expand diff selection from file-level to hunk-level context selection.
- [ ] Support multi-select aggregation before creating context packet.
- [ ] Keep context summary visible in composer before send.
- [ ] Preserve selected context when switching between Diff and Session mode.

## Session and streaming

- [ ] Create sessions via `/api/agent/sessions`.
- [ ] Send prompts via `/api/agent/sessions/:id/send`.
- [ ] Stream events via `/api/agent/sessions/:id/stream`.
- [ ] Reduce streamed events into timeline entries.
- [ ] Implement abort action using `DELETE /api/agent/sessions/:id/turn`.

## Terminal and attachments

- [ ] Replace simulated terminal output with `/api/term` WS flow.
- [ ] Wire image/file uploads to `/api/attachments` endpoints once implemented.

## UX integrity

- [ ] Keep picker keyboard controls working with all dialog states.
- [ ] Ensure `Ctrl/Cmd+K`, `Ctrl/Cmd+J`, `Esc` precedence is deterministic.
- [ ] Ensure command palette actions are disabled when backend capability is missing.

## Picker home controls

- [x] Add home controls for Theme, GitTrix settings, and Model access.
- [ ] Keep behavior parity between home quick controls and Settings modal.

## Definition of done (frontend)

- [ ] No critical workflow depends on mock-only data paths.
- [ ] Diff review -> context attach -> prompt send -> streamed timeline works end-to-end.
- [ ] Build and typecheck pass (`bun run --cwd web check`, `bun run --cwd web build`).
