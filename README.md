<p align="center">
  <img src="./glibcode-wordmark.png" alt="glib-code" width="720" />
</p>

<p align="center">
  <strong>Start fresh or with context. Work in isolation. Promote only what you accept.</strong>
</p>

<p align="center">
  <img src="./readme-screenshot.png" alt="glib-code app screenshot" width="1100" />
</p>

# glib-code

glib-code is an AI coding workspace where agents work in isolated GitTrix sessions instead of writing directly into your real repo.

Open a repo, start a session, let the agent work, review the diff, then promote only the files you accept.

## What it does

- Opens or clones local git repos.
- Reviews commit and working-tree diffs before prompting.
- Runs pi-backed agent sessions in isolated GitTrix workspaces.
- Streams assistant text, errors, and tool calls into a session timeline.
- Reviews session diffs before promote.
- Commits all or selected files back to the durable repo.
- Supports provider key management, model selection, GitHub durable promote, and local push/stash flows.

## How it works

```txt
open repo -> start session -> isolated agent edits -> review diff -> promote accepted files
```

Agent writes land in an ephemeral workspace first. Your real checkout only changes when you promote.

Deeper system details live in `Docs/Architecture.md`.

## Quick start

Requirements:

- Bun 1.x
- Git
- pi CLI/runtime for agent sessions
- Provider API key for the model you want to use

Install:

```bash
bun install
```

Run local web app:

```bash
bun run dev
```

Run desktop dev app:

```bash
bun run dev:desktop
```

Default dev URLs:

- API server: `http://127.0.0.1:4273`
- Web app: `http://127.0.0.1:5173`

Add a provider key in `Settings -> Models` before starting an agent session. Project picker and diff review work without a provider key.

## Scripts

```bash
bun run dev         # run server + web with prefixed logs
bun run dev:desktop # run server + web + Electron desktop shell
bun run dev:server  # backend only (:4273)
bun run dev:web     # frontend only (Vite)
bun run build       # build shared + server + web + desktop
bun run check       # typecheck all workspaces
```

## Repository layout

```txt
server/            Bun + Hono API, GitTrix orchestration, pi runtime bridge
web/               Vue frontend, diff workbench, session UI, settings
desktop/           Electron shell for packaged local app
shared/            Shared types, schemas, theme presets, event contracts
Docs/              Product, architecture, backend, frontend, agent, planning docs
suitener-results/  Committed external validation run artifacts
```

## Docs

- `Docs/Architecture.md`
- `Docs/SPEC.md`
- `Docs/Frontend.md`
- `Docs/Backend.md`
- `Docs/Agent.md`
- `Docs/Onboarding.md`
- `Docs/next-steps.md`
- `Docs/frontend-checklist.md`
- `Docs/backend-checklist.md`
- `Docs/T3_UI_PARITY_CHECKLIST.md`
