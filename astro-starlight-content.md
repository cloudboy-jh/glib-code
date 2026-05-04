---
title: glib-code
description: Review-first AI coding workspace with isolated agent sessions, GitTrix promote flows, and pi-powered model/provider access.
---

glib-code is a local-first AI coding workspace built around one rule: review code changes before prompting an agent, and only promote accepted agent changes back into your real repo.

Instead of letting an agent write directly into your working tree, glib-code opens a git repo, lets you inspect diffs, starts agent sessions with explicit context, runs those sessions in isolated GitTrix workspaces, then promotes selected changes back to the durable repo when you approve them.

## Core workflow

1. Open or clone a git repository.
2. Review uncommitted changes or commit history in the diff workbench.
3. Start a session from selected diff context.
4. Chat with a pi-powered coding agent.
5. Agent writes happen in an isolated GitTrix local workspace.
6. Review the session diff.
7. Promote selected files back to the durable repo.

## Why glib-code exists

Most coding-agent workflows start with a prompt and inspect the damage afterward. glib-code flips that:

- Review first, then prompt.
- Context comes from real repo diffs, not vague descriptions.
- Agent writes are isolated by default.
- Durable repo changes require explicit promote.
- Provider keys are managed inside glib-code, not silently pulled from other tools.

## Main features

### Project picker

The picker is the home surface for local repo work.

It supports:

- Opening an existing git repo.
- Cloning a repository.
- Recent projects.
- Missing-path and missing-git status handling.
- Quick access to Theme, GitTrix, and Model settings.
- Optional provider setup without blocking project open or diff review.

Provider keys are only required when starting or sending agent sessions.

### Diff workbench

The diff workbench is the review-first entrypoint.

It supports:

- Uncommitted working-tree diffs.
- Commit history diffs.
- Changed-file navigation.
- Patch rendering through `@pierre/diffs`.
- Starting sessions from selected diff context.

Planned next step:

- Hunk-level context selection.

### Agent sessions

Agent sessions are backed by real backend state, not local mock state.

Current behavior:

- Sessions are created through `/api/agent/sessions`.
- Prompts are sent through `/api/agent/sessions/:id/send`.
- Timeline events stream over `/api/agent/sessions/:id/stream` using SSE.
- Turns can be aborted with `DELETE /api/agent/sessions/:id/turn`.
- Session metadata and timeline events persist under repo-local `.glib/sessions`.

The timeline renders:

- User turns.
- Assistant text.
- Errors.
- Compact expandable tool-call cards.

### GitTrix isolation

glib-code uses GitTrix as the boundary between durable repo state and agent workspace state.

Current local MVP mode:

| Layer | Mode |
| --- | --- |
| Durable | Local repo |
| Ephemeral | Local workspace |
| Promote | Commit |

Agent work runs inside a GitTrix ephemeral workspace under:

```txt
<configDir>/gittrix-sessions/<session-id>/workspace
```

The user's durable repo is not modified directly by the agent.

### Session diff and promote

After an agent session changes files, glib-code can show a session diff and promote selected changes.

Current behavior:

- Fetch session diff with `GET /api/sessions/:id/diff`.
- Render session diff with `@pierre/diffs`.
- Select files for promote.
- Promote with `POST /api/sessions/:id/promote`.
- Surface baseline conflicts with structured conflict state.

If the durable branch moved and overlaps with selected files, the backend returns a `409 BASELINE_CONFLICT` payload and the UI shows a conflict modal.

Planned next step:

- Hunk-level promote selection.

### Provider and model access

Provider/model discovery is powered by pi.

glib-code does not ship or maintain a static provider/model catalog. The backend asks pi what providers and models are available, then the frontend renders that capability state.

Current provider UX:

- Searchable model picker.
- Usable/all/provider filters.
- Active model card in Settings.
- Provider rows with connected/needs-key state.
- Inline key add/remove flows.
- Active-provider error messages when a session cannot start.
- Optional OpenRouter onboarding when no providers are configured.

Provider keys are stored by glib-code under its own app config path:

```txt
Windows: %APPDATA%/glib-code/pi/auth.json
macOS:   ~/Library/Application Support/glib-code/pi/auth.json
Linux:   $XDG_CONFIG_HOME/glib-code/pi/auth.json or ~/.config/glib-code/pi/auth.json
```

glib-code does not read opencode or other app auth files.

### pi agent runtime

glib-code uses `@mariozechner/pi-coding-agent` as an in-process library.

Runtime details:

- No subprocess stdout parser layer.
- pi owns model/provider execution.
- glib-code normalizes pi events into shared `AgentEvent` records.
- Assistant runtime errors are surfaced as canonical error events.
- Tool execution is preserved as structured timeline data.
- Agent cwd is the GitTrix ephemeral workspace for that session.

### Settings

Settings includes:

- Models: active model, provider keys, provider status.
- GitTrix: local MVP mode and future mode visibility.
- Appearance: theme selection.
- Keybindings: keyboard shortcut editor.

Unavailable GitTrix modes are visible but disabled as `Coming Soon`, including:

- Cloudflare Artifacts.
- GitHub/GitLab durable providers.
- GitFork.
- Branch/PR/Patch promote strategies.

### Themes and UI

The UI uses Vue 3, Vite, Tailwind, and shared theme tokens.

Current UX highlights:

- Dark app shell.
- Sidebar sessions/home/settings navigation.
- Bottom-anchored composer.
- Scrollable timeline.
- Compact provider/model icons.
- Lazy-loaded diff-heavy UI for faster startup.
- Tool calls rendered as compact expandable cards instead of raw text dumps.

## Architecture

```txt
Vue 3 + Vite frontend
        │
        │ HTTP + SSE
        ▼
Bun + Hono backend
        │
        ├── pi coding agent runtime
        │
        └── GitTrix local session isolation
              ├── durable local repo
              └── ephemeral local workspace
```

## Monorepo layout

```txt
glib-code/
├── server/     # Bun + Hono API
├── web/        # Vue 3 + Vite frontend
├── desktop/    # Electron shell
├── shared/     # shared event/schema/theme contracts
├── Docs/       # living implementation docs
└── scripts/    # dev orchestration
```

## API surfaces

### Provider/model

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/providers` | List provider/model capabilities and defaults. |
| `PATCH` | `/api/providers/defaults` | Set default provider/model. |
| `POST` | `/api/providers/:id/auth` | Save provider API key. |
| `DELETE` | `/api/providers/:id/auth` | Remove provider API key. |

### Agent

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/agent/sessions` | Create agent session and GitTrix workspace. |
| `POST` | `/api/agent/sessions/:id/send` | Send a prompt. |
| `GET` | `/api/agent/sessions/:id/stream` | Replay + stream session events over SSE. |
| `DELETE` | `/api/agent/sessions/:id/turn` | Abort active turn. |
| `DELETE` | `/api/agent/sessions/:id` | Delete session. |

### Sessions and promote

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/sessions` | List project sessions. |
| `GET` | `/api/sessions/:id` | Read session metadata and events. |
| `GET` | `/api/sessions/:id/diff` | Diff ephemeral workspace against durable baseline. |
| `POST` | `/api/sessions/:id/promote` | Promote selected changes. |
| `POST` | `/api/sessions/:id/evict` | Evict session workspace. |

### Diff

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/diff/sources` | List diff sources. |
| `GET` | `/api/diff/items` | List commit/uncommitted diff items. |
| `GET` | `/api/diff/files` | List changed files. |
| `GET` | `/api/diff/hunks` | List hunks. |
| `POST` | `/api/diff/pack` | Pack selected diff context. |

## Local development

Requirements:

- Bun 1.x
- Git

Install dependencies:

```bash
bun install
```

Run the dev stack:

```bash
bun run dev
```

Default dev URLs:

- API server: `http://127.0.0.1:4273`
- Web app: `http://127.0.0.1:5173`

Useful scripts:

```bash
bun run dev         # server + web with prefixed logs
bun run dev:server  # backend only
bun run dev:web     # frontend only
bun run build       # build all workspaces
bun run check       # typecheck all workspaces
```

## Current limitations

The local review-first loop works, but these areas are still in progress:

- Terminal WebSocket transport (`/api/term`).
- Attachments API and composer attachment UX (`/api/attachments`).
- Git mutation endpoints under `/api/git` beyond status/log/branches.
- Hunk-level context and promote selection.
- Project-scoped provider/model overrides.
- Standardized route error envelopes.
- Cloudflare Artifacts adapter.

## Roadmap

Near-term priority order:

1. Terminal WebSocket transport.
2. Attachments API and frontend integration.
3. Git mutation route completion.
4. Hunk-level context/promote selection.
5. Reliability pass: structured errors, route tests, restart behavior, Electron parity.
6. Cloudflare Artifacts adapter once backend support lands.

## Product principles

- Local-first by default.
- Review-first, not prompt-first.
- Agent writes are isolated until promoted.
- Provider keys are explicit and glib-owned.
- Model/provider capability comes from runtime truth, not static UI catalogs.
- Diff review and project navigation should work without any provider key.
- Future cloud modes should preserve the same durable/ephemeral/promote boundary.
