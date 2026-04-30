# glib-code Spec (Current)

Last updated: 2026-04-30

glib-code is a local-first AI coding workspace centered on this loop:

1. Open a git repo
2. Review commit/uncommitted diffs
3. Start a session with selected diff context
4. Chat with an agent (currently UI scaffolding; backend agent runtime still stubbed)

## Thesis

- Review first, then prompt.
- The agent never writes to durable storage. Every session writes to ephemeral storage and only reaches durable via explicit user-triggered promote.

## Reality check

- The backend/API and picker/diff/settings/keybindings flows are real.
- GitTrix promote/write boundary, terminal WS, and attachments are still incomplete.
- Some frontend views still use local reactive mock data around session timelines.

## Stack

- Runtime: Bun
- API server: Hono (`server/`)
- Frontend: Vue 3 + Vite (`web/`)
- Desktop shell: Electron (`desktop/`)
- Shared contracts/tokens: `shared/`
- Git integration: `simple-git` + raw `git` subprocess calls
- Diff rendering: `@pierre/diffs`

## Architecture

```txt
Vue 3 + Vite (web/)
        │
        │ typed RPC (hc<AppType>)
        ▼
Hono server (server/)
   ├── opencode subprocess  ← agent (BYO provider)
   └── @gittrix/core        ← session storage, durable/ephemeral split, promote gate
        ├── adapter-local       (durable + ephemeral, MVP)
        ├── adapter-github      (durable, push/PR)
        └── adapter-cloudflare  (ephemeral, hosted "glib cloud" mode; owned by GitTrix)
```

GitTrix is orthogonal to product surface. Self-host, desktop, and hosted all keep GitTrix between glib and filesystem/git; the surface only changes which adapters are configured. glib does not wire backend-specific adapter internals directly.

## Provider/model authority

- opencode is the source of truth for provider auth + model availability.
- glib does not maintain an independent static provider/model catalog.
- backend stores only defaults/overrides/session snapshots and validates those selections against opencode-discovered capabilities.

## Monorepo layout

```txt
glib-code/
├── server/     # Hono API on Bun
├── web/        # Vue app
├── desktop/    # Electron entrypoint
├── shared/     # shared types/schemas/theme presets
├── Docs/       # living docs + implementation checklists
└── scripts/    # workspace dev orchestrator
```

## Runtime modes

- `bun run dev` runs server (`:4273`) + web (`:5173`) in parallel for development.
- `desktop/src/main.ts` runs an Electron window pointed at local server `http://127.0.0.1:4173`.

## Surface model

- Self-host
- Desktop
- Hosted

Surface determines adapter selection and deployment topology, not whether GitTrix is used.

## Product areas

- Project picker + recents + init/create repo
- Diff workbench (commit history + uncommitted diff + file-level navigation)
- Session workspace shell (sidebar/header/timeline/composer)
- Settings + keybindings persistence
- Readiness and health endpoints

## Source of truth docs

- `Docs/Frontend.md`
- `Docs/Backend.md`
- `Docs/Agent.md`
- `Docs/Onboarding.md`
- `Docs/next-steps.md`
- `Docs/frontend-checklist.md`
- `Docs/backend-checklist.md`

GitTrix contract lives in `cloudboy-jh/gittrix/SPEC.md`. glib-code consumes `@gittrix/core` as a library; this repo does not redefine the GitTrix API.

## Build order

1. Finalize Hono API contracts and typed RPC alignment with web session flows.
2. Land current-project ownership model beyond process-local memory.
3. Implement session lifecycle API routes in `server/`.
4. Implement opencode subprocess spawn, streaming (`--format json`), and event normalization.
5. Keep `/api/providers` discovery-backed from opencode and validate defaults/overrides/session create/send against that capability state.
6. Persist session timeline/events under glib state storage.
6. Wire `@gittrix/core` into `server/` — instantiate `GitTrix` with `adapter-local` for durable + ephemeral on first run, configurable per surface.
7. Map glib session ↔ gittrix session — the `glibSessionId ↔ gittrixSessionId` table, what survives a glib restart, what doesn’t.
8. Route the agent’s writes through `session.write()` — opencode write/edit tool calls land in ephemeral, not durable. InlineDiff reads `session.diff()`.
9. Implement promote — `POST /api/sessions/:id/promote` calls `session.promote({ selector, strategy })`, strategy selected by frontend (`branch` vs `commit` vs `pr`).
10. Handle promote conflicts — if durable HEAD moved since baseline, refuse auto-promote and return conflict payload; user resolves manually. v1 has no auto-merge.
11. Implement promote UI states for success, conflict, and retry flows.
12. Implement eviction daemon — Hono cron route calls adapter eviction on configured schedule (defaults: `ttl_idle` 4h, `until_promote` retention behavior).
13. Replace placeholder `/api/term` with transport and auth model used by session workspace.
14. Replace placeholder attachments routes with real upload/reference lifecycle.
15. Close remaining 501 git mutation endpoints needed for branch/push/pull workflows.
16. Reconcile diff source advertisements (`branches`, `prs`) with actual service support.
17. Add end-to-end integration tests covering diff->session->promote path.
18. Harden observability/logging and release guardrails per surface.
19. Ship desktop and self-host first-run onboarding parity with readiness checks.
20. Document hosted-mode rollout constraints and bridge latency budgets.
21. Cut MVP release with local adapter defaults and explicit non-goals.

## Out of scope (v1)

- See `cloudboy-jh/gittrix/SPEC.md` non-goals for core GitTrix limits (multi-agent sessions, cross-adapter merge chains, built-in conflict UI, real-time collaboration on one session).
- glib-side conflict resolution UI is out for v1. glib surfaces conflict details, user resolves in terminal, then retries promote.
