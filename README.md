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

## Download

Go to **[Releases](https://github.com/cloudboy-jh/glib-code/releases/latest)** and grab the file for your platform:

- **Windows** — `glib-code-Setup-*.exe`
- **Mac** — `glib-code-*.dmg`
- **Linux** — `glib-code-*.AppImage`

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

## Running locally (dev)

Requirements:

- Bun 1.x
- Git
- A provider API key (OpenAI, Anthropic, or any compatible provider)

```bash
bun install
bun run dev:desktop
```

This starts the API server, Vite dev server, and Electron window together. DevTools open automatically.

Default ports:
- API: `http://127.0.0.1:4273`
- Web: `http://127.0.0.1:5173`

Add a provider key in **Settings → Models** before starting an agent session. Project picker and diff review work without one.

## Building the desktop app

```bash
# Build all workspaces first
bun run build

# Then package for your platform
bun run --cwd desktop build:win    # Windows — outputs NSIS .exe
bun run --cwd desktop build:dmg    # Mac — outputs .dmg (arm64 + x64)
bun run --cwd desktop build:linux  # Linux — outputs .AppImage + .deb
```

Output goes to `desktop/dist-app/`.

## Releasing

Push a `v*` tag — GitHub Actions builds all three platforms and uploads the artifacts to a GitHub Release automatically.

```bash
git tag v0.x.y
git push origin v0.x.y
```

## Scripts

```bash
bun run dev            # server + web with prefixed logs
bun run dev:desktop    # server + web + Electron window
bun run dev:server     # API server only (:4273)
bun run dev:web        # Vite only (:5173)
bun run build          # build all workspaces
bun run check          # typecheck all workspaces
```

## Repository layout

```txt
server/        Bun + Hono API, session orchestration, pi runtime bridge
web/           Vue frontend, diff workbench, session timeline, settings
desktop/       Electron shell — packaging, first-launch flow, auto-update
shared/        Types, schemas, theme presets, event contracts
.github/       Release workflow (builds NSIS/DMG/AppImage on tag push)
Docs/          Architecture, spec, frontend, backend, agent docs
```

## Themes

<details>
<summary>Theme cycle preview</summary>

<p align="center">
  <img src="./assets/glib-code-theme-cycle1.gif" alt="glib-code theme cycle" width="1100" />
</p>

</details>
