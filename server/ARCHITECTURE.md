# Server Architecture

## Current Top Level

The server is a Hono API with route modules in `src/routes`, implementation modules in `src/services`, and shared filesystem/log helpers in `src/lib`.

`src/index.ts` should stay boring: create the app, install middleware, mount routes, boot persisted state, and serve.

`src/routes/index.ts` owns API route mounting so new endpoints have one obvious registration point.

## Route Ownership

- `agent`: agent session creation, turn send, SSE stream, abort, delete
- `sessions`: persisted session listing/detail/fork/diff/promote/evict route surface
- `projects`: open/init/create/forget projects, recents, per-project model override
- `providers`: pi provider discovery, auth, default provider/model
- `settings`: user settings
- `diff`: durable repo diff browsing and packed diff context
- `git`: durable repo git status/log/branches
- `repo`: current repo shell
- `fs`: current repo file browsing
- `auth`: GitHub auth status
- `readiness`/`health`: runtime readiness checks
- `attachments`, `keybindings`, `term`: app support endpoints

Routes should do HTTP work only: parse request data, call services, and shape responses. They should not own filesystem layout, runtime process state, or session reconstruction logic.

## Service Ownership

- `session-store`: persisted agent session docs, event logs, session metadata, app-level session ID index
- `agent-runtime`: live turn execution, SSE broadcast subscription registry, pi process cache, sandbox process cache, abort/dispose/respawn
- `gittrix-service`: durable/ephemeral GitTrix adapters, start/diff/promote/evict
- `sandbox`, `sandbox-cloudflare`: sandbox abstraction and concrete local/cloud runtime process/filesystem adapters
- `pi-core`, `pi-capabilities`, `pi-rpc`: pi package integration, auth/model registry, capability discovery, RPC adapter
- `projects`: project path inspection/open/init/create/forget and candidate discovery
- `diff`, `git`: durable repo read operations
- `settings-store`: settings, provider defaults, keybindings
- `project-store`: recents, current project, registered projects, project overrides
- `gittrix-local-adapter`, `gittrix-cloud-adapters`: GitTrix adapter implementations

## Known Boundary Problems

- Current-project lookup is duplicated in multiple routes/services.
- `agent` and `sessions` routes both know pieces of session/GitTrix lifecycle.
- Session operations historically treated browser `projectPath` as authoritative, which created split-brain lookup bugs. Agent/session routes now resolve by `sessionId` and stored metadata first, with explicit `projectPath` only as a scoped fallback.
- Turn status and session status are still conflated. A completed turn should not make the session terminal.

## Target Boundaries

Focused storage/domain modules:

- `settings-store`: settings, provider defaults, keybindings
- `project-store`: recents, registered projects, current project, project overrides
- `session-store`: session docs, index, events, metadata

Keep live runtime separate from persisted session state:

- persisted session state lives in `session-store`
- live pi/sandbox/turn state lives in `agent-runtime`
- GitTrix diff/promote/evict lives in `gittrix-service`

## Session Invariants

- `sessionId` plus stored session metadata is the authority for agent/session routes; explicit `projectPath` is a fallback to recover from reloads, project switches, or stale index state.
- Stored session metadata owns durable project path, GitTrix session ID, ephemeral path, baseline SHA, git-backed/workspace-kind flags, provider, and model.
- Agent turns run in the GitTrix ephemeral path only when it is git-backed and present; old/non-git sessions fall back to durable cwd.
- Pi can exit and respawn inside the same sandbox without deleting the session.
- RPC prompt completion is keyed to `agent_end`; `turn_end` is only one model/tool cycle.
- Sandbox destruction happens only on explicit delete/evict.
- SSE replay comes from the persisted event log.
- Diff/promote resolve through stored session metadata, not browser project state.

## Refactor Order

1. Keep route mounting centralized in `src/routes/index.ts`.
2. Extract current-project helpers from repeated route code.
3. Move session/GitTrix orchestration behind a single session-domain service.
4. Add lifecycle tests for create, multi-turn send, stream replay, pi respawn, diff, promote, abort, and delete.
5. Run `Docs/session-smoke-test.md` before calling local sessions ready.
