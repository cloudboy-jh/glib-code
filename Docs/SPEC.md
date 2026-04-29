# glib-code Spec (Current)

Last updated: 2026-04-29

glib-code is a local-first AI coding workspace centered on this loop:

1. Open a git repo
2. Review commit/uncommitted diffs
3. Start a session with selected diff context
4. Chat with an agent (currently UI scaffolding; backend agent runtime still stubbed)

## Reality check

- The backend/API and picker/diff/settings/keybindings flows are real.
- Agent runtime, session persistence, terminal WS, and attachments are still placeholder routes.
- Some frontend views still use local reactive mock data around session timelines.

## Stack

- Runtime: Bun
- API server: Hono (`server/`)
- Frontend: Vue 3 + Vite (`web/`)
- Desktop shell: Electron (`desktop/`)
- Shared contracts/tokens: `shared/`
- Git integration: `simple-git` + raw `git` subprocess calls
- Diff rendering: `@pierre/diffs`

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
