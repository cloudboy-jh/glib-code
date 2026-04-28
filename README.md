<p align="center">
  <img src="./glibcode-wordmark.png" alt="glib-code" width="1100" />
</p>

# glib-code

Review-first AI coding workspace.

Most agent tools make you prompt first and review later. glib-code flips that: browse git context first, then prompt with grounded context.

## What it is

- Diff-first workflow for AI coding
- Session/chat workspace for agent turns
- Local-first Bun + Hono backend
- Vue frontend with keyboard-first UX
- Planned Gittrix-backed ephemeral session routing with human-only promote

## Current status

Early alpha.

Working now:
- Project open/create + recents persistence
- Core diff routes (`sources`, `items`, `files`, `hunks`, `pack`)
- Settings + keybindings persistence
- Main UI shell (picker, diff/session surfaces, command palette/settings/terminal UI)

In progress / planned:
- Full agent runtime + SSE stream
- Session persistence + lifecycle routes
- Promotion-gated durable writes via Gittrix
- Branch compare, attachments, terminal WS backend

## Quick start (dev)

Requirements:
- Bun 1.x
- Git

Install:

```bash
bun install
```

Run full dev stack (single terminal):

```bash
bun run dev
```

Open the app at the Vite URL shown in terminal (usually `http://localhost:5173`).

## Scripts

```bash
bun run dev         # server + web with colored prefixed logs
bun run dev:server  # backend on :4273
bun run dev:web     # frontend via Vite
bun run build       # build shared + server + web + desktop
bun run check       # typecheck all workspaces
```

## Repo layout

```txt
glib-code/
├── server/   # Bun + Hono API
├── web/      # Vue + Vite frontend
├── desktop/  # Electron wrapper
├── shared/   # shared types/schemas/theme tokens
└── Docs/     # product + architecture + implementation plans
```

## Docs

- `Docs/SPEC.md`
- `Docs/Frontend.md`
- `Docs/Backend.md`
- `Docs/Agent.md`
- `Docs/next-steps.md`
- `Docs/frontend-checklist.md`
- `Docs/backend-checklist.md`

## Roadmap direction

Primary backend direction is Gittrix integration for ephemeral model workspaces and human-gated promotion into durable repos.
