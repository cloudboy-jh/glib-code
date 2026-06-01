# Architecture

Last updated: 2026-05-18

glib-code is a local-first AI coding workspace with one hard boundary: agent writes happen outside the durable repo until the user reviews and promotes them.

## The loop

```txt
open repo
  -> start session
  -> agent edits isolated workspace
  -> review session diff
  -> promote accepted files
  -> durable repo changes
```

## Main parts

- Frontend: Vue/Vite web UI and Electron desktop shell.
- Backend: Bun/Hono API server for repo access, full durable-repo git mutations, sessions, GitTrix orchestration, settings, auth, and SSE.
- Agent runtime: pi RPC subprocess running in a sandbox.
- Workspace boundary: GitTrix creates the ephemeral session workspace and promotes accepted changes back.
- Durable repo: the user's real checkout or GitHub durable target.

## Storage boundaries

- Durable repo: the user's real git repo. Agent tools do not write here directly during normal sessions.
- Ephemeral workspace: GitTrix-managed session workspace where agent edits land.
- Session metadata: repo-local `.glib/sessions` JSON docs and timelines.
- App config: OS app config directory for settings, provider keys, GitHub auth, session index, and GitTrix roots.

Provider keys live under app config, not the repo:

```txt
Windows: %APPDATA%/glib-code/pi/auth.json
macOS:   ~/Library/Application Support/glib-code/pi/auth.json
Linux:   $XDG_CONFIG_HOME/glib-code/pi/auth.json or ~/.config/glib-code/pi/auth.json
```

GitHub device auth tokens live at `<configDir>/auth/github.json`.

## Runtime boundaries

- Frontend owns interaction, session timeline rendering, diff review, and promote UI.
- Backend owns API routes, project/session state, GitTrix orchestration, and SSE streams.
- pi owns provider/model discovery and agent execution.
- Sandbox owns where pi runs.
- GitTrix owns durable/ephemeral storage boundaries and promote behavior.

pi RPC prompts complete on `agent_end`; `turn_end` is only one model/tool cycle.

## Local web app

`bun run dev` runs the Bun API server and Vite frontend on the same machine.

- API server: `http://127.0.0.1:4273`
- Web app: `http://127.0.0.1:5173`
- Filesystem access: local machine only
- Agent execution: local pi subprocess in a sandbox
- Durable storage: local git repo or GitHub durable adapter
- Ephemeral storage: local GitTrix workspace by default

## Desktop app

`bun run dev:desktop` wraps the same web UI with Electron and starts or connects to the local backend.

- API server: local Bun backend
- UI shell: Electron
- Dev UI: Vite app on strict port `5173`
- Production UI: built web bundle loaded by Electron
- Filesystem access: local machine through backend routes
- Agent execution: local pi subprocess in a sandbox

## Self-hosted server

The server can run as a normal Bun/Hono service. In this mode, the server host owns filesystem and agent execution.

- API server: Bun/Hono
- UI: built web app or separate frontend host
- Filesystem access: server host only
- Agent execution: server host
- Durable storage: repos available to the server process
- Security model: do not expose broadly without auth and filesystem scoping

## Hosted / future remote modes

Hosted glib-code should not directly touch a user's local filesystem. The intended future split is:

- Hosted UI + control plane on glibcode.com.
- Desktop bridge for local filesystem and local agent execution.
- Optional GitHub durable adapter for cloud projects.
- Optional Cloudflare/GitTrix ephemeral adapter for hosted workspaces.
- Explicit sync/promotion boundaries between hosted workspace and durable repo.

Future hosted modes preserve the same rule: agent edits land in an isolated workspace first, and accepted changes are promoted explicitly.

## Backend internals

Backend route/service ownership lives in `server/ARCHITECTURE.md`.
