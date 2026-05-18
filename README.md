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

glib-code is an AI coding workspace built around one rule: the agent does not write directly into your durable repo. Start a fresh session or attach explicit context, let the agent work in an isolated workspace, then promote only the files you accept.

It combines a diff-first review UI, pi-backed coding agents, and GitTrix workspace isolation into one app.

## Core Ideas

- Flexible session workflow: start from a blank prompt or attach repo context when it helps.
- Contextful sessions: attach a selected commit, working tree diff, or file scope.
- Isolated execution: agent writes happen in a GitTrix ephemeral workspace, not your main checkout.
- Explicit promotion: changes move back to the durable repo only through review and promote.
- Provider-neutral models: provider/model availability comes from pi capability discovery, not hardcoded frontend lists.
- Explicit execution boundaries: project files, sessions, provider keys, and GitTrix workspaces live wherever the selected distribution mode runs them.

## Feature Set

Current product surface:

- Project picker with open, clone, recents, and project mode selection.
- Diff workbench for commit history and uncommitted changes.
- Session workspace with timeline, composer, streamed assistant text, errors, and tool-call cards.
- Agent sessions backed by pi RPC and GitTrix ephemeral workspaces.
- Provider key management and model selection in Settings.
- GitHub device sign-in for GitHub durable promote flows.
- Git-backed local session workspaces using GitTrix worktrees with clone fallback.
- Session diff review before promote, rendered with `@pierre/diffs`.
- Commit-all or file-selected promote from ephemeral workspace back to durable repo.
- Local stash-and-continue plus local push for upstream-backed repos.
- Theme and basic app settings.

Planned product surface:

- Terminal transport connected to project or session workspace.
- Composer attachments.
- Remaining git mutation routes: stage, unstage, discard, pull, checkout, branch.
- Hunk-level context selection and hunk-level promote.
- Hosted and remote workspace adapters.

## Architecture

```txt
web / desktop UI
  -> Hono API server
  -> pi agent runtime
  -> sandbox process
  -> GitTrix ephemeral workspace
  -> explicit promote
  -> durable git repo
```

Workspace boundaries:

- Durable repo: the user's real checkout.
- Ephemeral workspace: a GitTrix-managed session workspace where agent edits land.
- Session metadata: repo-local `.glib/sessions` JSON documents.
- App config: OS app config directory for settings, provider keys, and local GitTrix roots.

Runtime boundaries:

- Frontend owns interaction, session timeline rendering, diff review, and promote UI.
- Backend owns API routes, project/session state, GitTrix orchestration, and SSE streams.
- pi owns provider/model discovery and agent execution.
- Sandbox owns where pi runs.
- GitTrix owns durable/ephemeral storage boundaries and promote behavior.
- pi RPC prompts complete on `agent_end`; glib keeps listening across tool cycles so final assistant text arrives after tool execution.

Provider keys are stored under glib-code's app config, not in the repo:

```txt
Windows: %APPDATA%/glib-code/pi/auth.json
macOS:   ~/Library/Application Support/glib-code/pi/auth.json
Linux:   $XDG_CONFIG_HOME/glib-code/pi/auth.json or ~/.config/glib-code/pi/auth.json
```

## Distribution Modes

### Local Web App

The local web app runs the Bun API server and Vite frontend on the same machine.

Use this for development and power-user local workflows.

```bash
bun run dev
```

- API server: `http://127.0.0.1:4273`
- Web app: `http://127.0.0.1:5173`
- Filesystem access: local machine only
- Agent execution: local pi subprocess in a sandbox
- Durable storage: local git repo
- Ephemeral storage: local GitTrix workspace

### Desktop App

The desktop app wraps the same web UI with Electron and starts or connects to the local backend.

Use this as the intended packaged local product.

```bash
bun run dev:desktop
```

- API server: local Bun backend
- UI shell: Electron
- Dev UI: Vite app on strict port `5173`
- Production UI: built web bundle loaded by Electron
- Filesystem access: local machine through backend routes
- Agent execution: local pi subprocess in a sandbox

### Self-Hosted Server

The server can run as a normal Bun/Hono service. In this mode, the machine running the server owns filesystem and agent execution.

Use this for a private LAN/devbox setup where the repo and agent runtime live on the same host as the backend.

- API server: Bun/Hono
- UI: built web app or separate frontend host
- Filesystem access: server host only
- Agent execution: server host
- Durable storage: repos available to the server process
- Security model: do not expose broadly without auth and filesystem scoping

### Hosted / Future Remote Modes

Hosted glib-code should not directly touch a user's local filesystem. The intended future split is:

- Hosted UI + control plane on glibcode.com.
- Desktop bridge for local filesystem and local agent execution.
- Optional GitHub durable adapter for cloud projects.
- Optional Cloudflare/GitTrix ephemeral adapter for hosted workspaces.
- Explicit sync/promotion boundaries between hosted workspace and durable repo.

Future hosted modes should preserve the same product rule: agent edits land in an isolated workspace first, and accepted changes are promoted explicitly.

## Quick Start

Requirements:

- Bun 1.x
- Git
- pi CLI/runtime available for agent sessions
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

## Repository Layout

```txt
server/   Bun + Hono API, GitTrix orchestration, pi runtime bridge
web/      Vue frontend, diff workbench, session UI, settings
desktop/  Electron shell for packaged local app
shared/   Shared types, schemas, theme presets, event contracts
Docs/     Product, backend, frontend, agent, and planning docs
suitener-results/  Committed external validation run artifacts
```

## Development Notes

- Keep the README stable and user-facing. Do not use it as a per-commit changelog.
- Use `Docs/next-steps.md` for planning and current priorities.
- Use focused docs under `Docs/` for implementation details.
- Run `bun run check` before shipping code changes.
- `suitener-results/latest.json` points at the latest committed external validation run when those artifacts are included.

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
