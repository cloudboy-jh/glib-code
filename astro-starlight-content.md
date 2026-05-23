---
title: glib-code
description: Portable source document for generating the full glib-code docs IA in another repo/agent run.
---

# glib-code documentation source (portable)

Use this single markdown file as source material for another agent to generate a Starlight docs site with the exact IA below.

This is intentionally opinionated and implementation-aware.

## IA target (must match)

Top-level nav:

- Introduction
- Why glib-code
- Getting Started

Concepts:

- Review-first loop
- Sessions
- Promote
- Provider/model authority
- GitTrix isolation

Surfaces:

- Web
- Server
- Desktop

API Reference:

- Providers
- Agent
- Sessions
- Diff

Guides:

- Run locally
- GitTrix integration

---

## Introduction

glib-code is a review-first coding workflow for shipping agent-written changes without losing control of your repo.

Agents can generate quickly. The failure mode is letting generated edits touch durable git state before review. glib-code fixes that by isolating agent work, rendering changes as diffs, and only promoting accepted output.

## Architecture

```txt
Developer -> Web/Desktop -> Server -> Provider/Model -> Agent Session
Agent Session -> Ephemeral Workspace -> Review Diff -> Promote -> Durable Repo
```

## Why glib-code

Most agent tools are prompt-first and review-later.

glib-code is review-first by design:

- inspect real diffs before and after agent work
- keep agent writes isolated from durable repo
- require explicit promotion of accepted changes
- keep provider/model choice explicit, not ambient
- allow diff/project workflows without provider keys

## Getting Started

1. Open or clone a repository.
2. Choose **Diffs** or **Session** entry mode.
3. In Diffs mode, review working tree/commit diffs.
4. Start or continue a session.
5. Let the agent work in isolated GitTrix workspace.
6. Review session-produced diff.
7. Promote approved files back to durable repo.

---

## Concepts

### Review-first loop

Core loop:

1. Start from real repo state
2. Run agent in isolation
3. Review diff
4. Promote accepted output
5. Keep durable repo clean

### Sessions

Session = unit of agent work + timeline + isolated workspace mapping.

Current behavior:

- create: `POST /api/agent/sessions`
- send: `POST /api/agent/sessions/:id/send`
- stream: `GET /api/agent/sessions/:id/stream`
- abort: `DELETE /api/agent/sessions/:id/turn`
- delete: `DELETE /api/agent/sessions/:id`

Session timeline includes user turns, assistant output, tool calls, errors, and turn lifecycle events.

### Promote

Promote is explicit transfer from ephemeral session workspace to durable repo.

Current flow:

- compute session diff
- select files
- commit promote payload
- optionally push when upstream/backing mode allows

Conflict/dirty protections are enforced before mutation.

### Provider/model authority

Provider/model capabilities come from runtime (pi), not static UI catalogs.

Design rules:

- provider auth is app-managed
- model availability reflects runtime truth
- missing auth blocks agent execution, not project/diff browsing

### GitTrix isolation

GitTrix provides durable/ephemeral boundary.

- durable: local repo (or configured durable adapter)
- ephemeral: session workspace for agent edits
- promote: controlled copy/commit back to durable

---

## Surfaces

### Web

Vue/Vite app for project picker, diff workbench, sessions, promote UI.

Key UX points:

- mode selection on project open (Diffs vs Session)
- inline mode cards in recent projects
- typed tool-call rendering in timeline
- diff rendering through Pierre (`@pierre/diffs`)
- in-app destructive confirmations (session delete)

### Server

Bun/Hono API for sessions, agent runtime, diff, providers, promote.

Current responsibilities:

- session metadata/event persistence
- SSE replay + stream
- agent event normalization
- structured tool result typing (`resultType`, `summary`, `artifact`)
- GitTrix session orchestration

### Desktop

Electron shell wrapping web/server workflow with native integrations (e.g., folder picker).

---

## API Reference

### Providers

- `GET /api/providers`
- `PATCH /api/providers/defaults`
- `POST /api/providers/:id/auth`
- `DELETE /api/providers/:id/auth`

### Agent

- `POST /api/agent/sessions`
- `POST /api/agent/sessions/:id/send`
- `GET /api/agent/sessions/:id/stream?projectPath=...&replay=...`
- `DELETE /api/agent/sessions/:id/turn?projectPath=...`
- `DELETE /api/agent/sessions/:id`

### Sessions

- `GET /api/sessions`
- `GET /api/sessions/:id?projectPath=...`
- `GET /api/sessions/:id/diff?projectPath=...`
- `POST /api/sessions/:id/promote?projectPath=...`

### Diff

- `GET /api/diff/sources`
- `GET /api/diff/items`
- `GET /api/diff/files`
- `GET /api/diff/hunks`
- `POST /api/diff/pack`

---

## Guides

### Run locally

Requirements:

- Bun
- Git
- pi runtime/CLI
- provider key for agent sessions

Commands:

```bash
bun install
bun run dev
```

Defaults:

- API: `http://127.0.0.1:4273`
- Web: `http://127.0.0.1:5173`

### GitTrix integration

Use GitTrix as isolation boundary:

- start session workspace from durable repo context
- run agent writes only in ephemeral workspace
- review produced diff
- promote selected files back to durable

---

## Repository map

```txt
glib-code/
├── web/
├── server/
├── shared/
├── desktop/
├── scripts/
└── Docs/
```

## Current priorities

- richer typed tool artifacts and timeline components
- less raw output in default UI paths
- promote ergonomics (finer-grained selection)
- resilience under reconnect/restart/multi-session load

## Product principles

- review first
- isolate agent edits
- explicit promote to durable git
- runtime-truth provider/model authority
- avoid hidden side effects
