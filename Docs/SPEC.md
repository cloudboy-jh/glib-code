# glib-code Spec (Current)

Last updated: 2026-05-04

glib-code is a review-first AI coding workspace centered on this loop:

1. Open a git repo
2. Review commit/uncommitted diffs
3. Start a session with selected diff context
4. Chat with an agent running in an isolated ephemeral workspace
5. Promote accepted changes back to the durable repo

## Thesis

- Review first, then prompt.
- Agent writes are isolated by default and never land in durable storage unless user-promoted.

## Current reality

- Agent runtime uses pi as an in-process library.
- Session isolation is handled by GitTrix local workspaces.
- Provider/model capability authority is pi.
- glib-code stores user-entered provider keys in its own app config dir, not another tool's auth store.
- Promote is explicit via session APIs and returns structured conflicts on baseline drift.

## Stack

- Runtime: Bun
- API server: Hono (`server/`)
- Frontend: Vue 3 + Vite (`web/`)
- Desktop shell: Electron (`desktop/`)
- Shared contracts/tokens: `shared/`
- Session isolation + promote boundary: GitTrix
- Diff rendering: `@pierre/diffs`

## Architecture

```txt
Vue 3 + Vite (web/)
        │
        │ typed RPC + SSE
        ▼
Hono server (server/)
   ├── pi agent library (@mariozechner/pi-coding-agent)
   └── GitTrix local adapter shim
        ├── durable repo (user project)
        └── ephemeral workspace (<configDir>/gittrix-sessions/<id>/workspace)
```

## Provider/model authority

- pi is the source of truth for provider auth + model availability.
- glib does not maintain a static provider/model catalog.
- backend stores defaults and validates selections against pi capability state.
- provider API keys are saved under glib-code app config (`<configDir>/pi/auth.json`).
- unsupported OAuth credentials do not count as usable auth for agent sessions.

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
- `bun run dev:desktop` runs server (`:4273`) + web (`:5173`) + Electron in parallel.
- Desktop dev loads the Vite app at `http://127.0.0.1:5173` and logs renderer output to the dev terminal.
- Desktop production starts the Bun backend on `:4273` and loads the built web app from `web/dist/index.html`.

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
- Model picker + provider key management
- Session timeline with streamed assistant text, errors, and compact tool-call cards
- Session diff review and file-level promote
- Readiness and health endpoints

## Source of truth docs

- `Docs/Frontend.md`
- `Docs/Backend.md`
- `Docs/Agent.md`
- `Docs/Onboarding.md`
- `Docs/next-steps.md`
- `Docs/frontend-checklist.md`
- `Docs/backend-checklist.md`

GitTrix contract lives in `cloudboy-jh/gittrix/SPEC.md`. glib-code consumes GitTrix as a library and does not redefine its API.

## Build order

1. Terminal WebSocket transport (`/api/term`) with stable reconnect behavior.
2. Attachments API and frontend upload/reference flow.
3. Git mutation routes parity (`stage/unstage/commit/push/pull/checkout`).
4. Hunk-level session promote selection.
5. Reliability pass: route tests, error envelopes, restart recovery checks.
6. Cloudflare Artifacts adapter once GitTrix backend support lands.

## Out of scope (v1)

- Multi-agent collaborative sessions.
- Cross-adapter promote chains.
- In-app conflict resolution/merge UI (conflicts are surfaced; resolution happens in git tooling).
