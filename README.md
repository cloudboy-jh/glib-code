<p align="center">
  <img src="./glibcode-wordmark.png" alt="glib-code" width="1100" />
</p>

# glib-code

Review-first AI coding workspace.

## What exists right now

- Monorepo with `server`, `web`, `desktop`, `shared`
- Real project picker/open/init/create + recents persistence
- Real diff API for uncommitted + commit history sources
- Real settings + keybindings + readiness + health endpoints
- Provider/model capability API backed by opencode discovery (`/api/providers`)
- Vue shell for diff/session workflows

## Not finished yet

- GitTrix service boundary wiring (`session.write/promote/evict`)
- Git mutation routes (most `/api/git/*` still 501)
- Terminal WS and attachments routes

## Runtime authority boundary

- opencode owns provider/model/auth truth.
- glib backend stores selection state (defaults/overrides/session snapshot) and validates against opencode capabilities.
- glib frontend renders capability state from backend; it does not hardcode provider/model catalogs.

## Quick start

Requirements:

- Bun 1.x
- Git

Install:

```bash
bun install
```

Run dev stack:

```bash
bun run dev
```

- API server: `http://127.0.0.1:4273`
- Web app: `http://127.0.0.1:5173`

## Scripts

```bash
bun run dev         # run server + web with prefixed logs
bun run dev:server  # backend only (:4273)
bun run dev:web     # frontend only (vite)
bun run build       # build shared + server + web + desktop
bun run check       # typecheck all workspaces
```

## Docs

- `Docs/SPEC.md`
- `Docs/Frontend.md`
- `Docs/Backend.md`
- `Docs/Agent.md`
- `Docs/Onboarding.md`
- `Docs/next-steps.md`
- `Docs/frontend-checklist.md`
- `Docs/backend-checklist.md`
- `Docs/T3_UI_PARITY_CHECKLIST.md`
