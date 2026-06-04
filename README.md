<p align="center">
  <img src="./assets/glibcode-wordmark.png" alt="glib-code" width="720" />
</p>

<p align="center">
  <strong>Start fresh or with context. Work in isolation. Promote only what you accept.</strong>
</p>

<p align="center">
  <img src="./assets/glib-demo-gif.gif" alt="glib-code demo" width="1100" />
</p>

# glib-code

glib-code is an AI coding workspace where agents make changes in a safe sandbox, so your real code stays untouched until you approve.

Open a repo, start a session, let the agent work, review the diff, then accept only the files you want.

## What it does

- Opens or clones local Git repositories.
- Lets you review commit history and current working changes before you prompt the agent.
- Runs each agent session in an isolated workspace (powered by GitTrix under the hood).
- Streams assistant output, errors, and tool activity into a live timeline.
- Shows a session diff so you can inspect exactly what changed.
- Applies only selected files back to your real repo when you approve.
- Supports provider key management, model selection, GitHub push flows, and local push/stash flows.

## How it works

```txt
open repo -> start session -> agent edits in sandbox -> review diff -> apply accepted files
```

Agent writes go to a temporary workspace first. Your real checkout only changes when you apply approved files.

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

Add a provider key in `Settings -> Models` before starting an agent session. Project picker and diff review still work without a provider key.

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
server/            Bun + Hono API, sandbox/session orchestration, pi runtime bridge
web/               Vue frontend, diff workbench, session timeline, settings
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

## Themes

<details>
<summary>Theme cycle preview</summary>

<p align="center">
  <img src="./assets/glib-code-theme-cycle1.gif" alt="glib-code theme cycle" width="1100" />
</p>

</details>
