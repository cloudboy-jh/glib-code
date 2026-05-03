# glib-code: pi + GitTrix + Provider Auth UX + Frontend Wiring

Rebuild of glib-code's core agent layer, session isolation, and frontend data plane.

## Context

glib-code is a review-first AI coding workspace. Open repo → review diffs → start session with diff context → agent works in isolation → promote accepted changes to durable.

**Current state (as of 2026-05-02):**

- Agent runtime works via **opencode subprocess** (`Bun.spawn` + NDJSON parsing). Routes exist for create/send/stream/abort/delete and are functional.
- No session isolation. Agent writes land directly in the user's repo. No promote gate.
- GitTrix is not installed, not wired.
- Provider auth is CLI-only (`opencode auth login`). No in-app auth UX.
- Backend: terminal/attachments/git-mutations are 501 stubs (out of scope for this pass).
- Frontend: **entirely mock/local**. Sessions, timelines, prompt sending, terminal — all local reactive state with zero API calls. No SSE consumption.

**Target:** Replace opencode with pi in-process runtime. Add GitTrix ephemeral workspace isolation. Add in-app provider auth UX. Wire the frontend to real backend routes end-to-end.

## Architecture decisions (locked)

- **Agent runtime:** pi (`@mariozechner/pi-coding-agent`) used as in-process library. No subprocess, no NDJSON.
- **Agent isolation:** GitTrix ephemeral workspace. Agent cwd = ephemeral path. No tool-call interception needed for write safety.
- **Provider/model authority:** pi owns provider config and model discovery. glib-code validates against pi capability state.
- **Promote:** explicit via `POST /api/sessions/:id/promote`. Returns 409 on baseline conflict.

## Phase 1: Provider auth UX (unblocks everything)

### Why first

Users can't do anything without a configured provider. This phase doesn't depend on pi or GitTrix — works against the current opencode setup and stays compatible when we swap to pi in Phase 2.

### Steps

1. **Backend: `POST /api/providers/:id/auth`** in `server/src/routes/providers.ts`
   - Body: `{ apiKey: string }`
   - Writes key to opencode's provider config so `opencode auth list` picks it up
   - Refreshes the opencode-capabilities cache
   - Returns `{ ok: true, models: number }`

2. **Backend: `DELETE /api/providers/:id/auth`** — removes the provider key, refreshes cache.

3. **Frontend: Settings → Models tab** (`web/src/components/settings/SettingsModal.vue`)
   - For each provider with `hasAuth: false`, show "Add API key" button
   - Clicking opens inline input + Save
   - Save calls `POST /api/providers/:id/auth`, refreshes `/api/providers`
   - For configured providers, show "Remove" link
   - Banner if no providers are configured: "New here? Get started with OpenRouter — one key, all models."

4. **Frontend: Picker first-run card** (`web/src/components/picker/PickerScreen.vue`)
   - If `/api/providers` returns zero authenticated providers, show setup card above "Get Started"
   - Card: provider dropdown (default OpenRouter), key input, save button
   - On save, POST to `/api/providers/:id/auth`, refresh state, hide card

5. **Frontend: App.vue** — fetch `/api/providers` on mount, store auth state, pass to Picker.

### Acceptance

- Fresh install → picker shows provider setup card
- Paste key → providers populate, project options appear
- Settings → Models shows configured/unconfigured state with Add/Remove actions

## Phase 2: Replace opencode with pi

### Steps

1. Add `@mariozechner/pi-coding-agent` to `server/package.json`. Remove opencode env-var references from agent-runtime.

2. Replace `server/src/services/agent-runtime.ts`:
   - Import `AgentSession` from pi
   - Replace subprocess + NDJSON parser with: instantiate `AgentSession` per glib session, subscribe to event stream, normalize pi events into `AgentEvent` from `shared/src/events/agent.ts`
   - Pi events map: `message_update` → text deltas, `tool_execution_*` → tool events, `turn_start`/`turn_end`
   - Keep existing SSE broadcast pattern: `subscribe(sessionId, fn)`, `runTurn` shape unchanged
   - Remove `eventFromOpencode`, `OpencodeEvent` types, all NDJSON parsing

3. Replace `server/src/services/opencode-capabilities.ts` → `server/src/services/pi-capabilities.ts`:
   - Pi exposes `get_available_models` and provider config programmatically
   - Return same `{ ok, providers: [{ id, hasAuth, modelIds }] }` shape
   - Provider list: anthropic, openai, google, openrouter, xai, groq, mistral, etc.

4. Update `server/src/routes/providers.ts` to use pi-capabilities. Same routes, same shapes.

5. Update `server/src/routes/readiness.ts` to use pi-capabilities.

6. Update `server/src/routes/agent.ts` — provider/model validation against pi-capabilities. `cwd` stays as `project.path` for now (fixed in Phase 3).

7. Delete `shared/src/events/opencode.ts`. Update `shared/src/index.ts` exports.

8. Run `bun run --cwd server check`. Fix type errors.

### Acceptance

- Send prompt → real streaming text deltas in SSE
- `/api/providers` returns pi-discovered providers
- No opencode references in `server/`

## Phase 3: Wire GitTrix

### Steps

1. Add `@gittrix/core` and `@gittrix/adapter-local` to `server/package.json`.

2. Create `server/src/services/gittrix.ts`:
   - Lazy-instantiate `GitTrix` with `LocalFsAdapter({ sessionsRootDir: join(getConfigDir(), 'gittrix-sessions') })`
   - Expose: `startSession`, `getSession`, `diff`, `promote`, `evict`

3. Extend `SessionMeta` in `server/src/services/sessions.ts`:
   - Add `gittrixSessionId`, `ephemeralPath`, `baselineSha`
   - Update `createSession()` to accept and persist these

4. Update `server/src/routes/agent.ts`:
   - `POST /sessions`: call `gittrixService.startSession()` before `createSession()`. Pass returned values. If GitTrix fails, return 500, don't create glib session.
   - `POST /sessions/:id/send`: change `runTurn` cwd from `project.path` to `existing.meta.ephemeralPath`
   - `DELETE /sessions/:id`: after abort + deleteSession, call `gittrixService.evict()` (best-effort, swallow errors)

5. Add to `server/src/routes/sessions.ts`:
   - `GET /:id/diff` → `gittrixService.diff(meta.gittrixSessionId)`, return `{ diff: string }`
   - `POST /:id/promote` → body `{ selector: { mode: 'all' } | { mode: 'files', files: string[] }, strategy?, message? }`. On conflict: 409 with `{ code: 'BASELINE_CONFLICT', conflictingFiles, durableSha, baselineSha }`. On success: `{ sha, branch, prUrl? }`
   - `POST /:id/evict` → `gittrixService.evict()`, return `{ ok: true }`

6. No internal `/write` route needed. Pi's writes via cwd to ephemeral path are sufficient.

7. Run `bun run --cwd server check`.

### Acceptance

- Create session → GitTrix session created, ephemeral workspace on disk
- Agent writes file → file lands in ephemeral, NOT user's repo
- `GET /api/sessions/:id/diff` returns unified diff
- `POST /api/sessions/:id/promote` creates commit on user's repo
- Delete session → ephemeral workspace cleaned up

## Phase 4: Frontend data-plane switch

### Steps

1. **API base config:** Replace hardcoded `http://127.0.0.1:4273/api` in `App.vue` and `DiffWorkbench.vue` with env-driven config. Centralize in one module.

2. **Session data:** Replace local reactive sessions with API-backed data.
   - On mount, `GET /api/sessions` to hydrate session list
   - `createSession()` → `POST /api/agent/sessions`
   - Remove localStorage session persistence

3. **Agent streaming:** Consume SSE from `/api/agent/sessions/:id/stream`.
   - Wire `sendPrompt()` to `POST /api/agent/sessions/:id/send`
   - Consume SSE events, reduce into timeline entries (text deltas, tool calls, turn boundaries)
   - Wire abort action to `DELETE /api/agent/sessions/:id/turn`

4. **Promote UX:**
   - Add diff viewer to session surface using `/api/sessions/:id/diff` + `@pierre/diffs`
   - File/hunk selection for promote selectors
   - Promote button → `POST /api/sessions/:id/promote`
   - 409 conflict modal with structured error display

5. **Provider auth UX** (from Phase 1 frontend work) should already be in place.

6. Run `bun run --cwd web check` and `bun run --cwd web build`.

### Acceptance

- Diff review → context attach → prompt send → streamed timeline works end-to-end
- No critical workflow depends on mock-only data paths
- Build and typecheck pass

## Phase 5: Docs + verification

### Steps

1. Update `Docs/SPEC.md`, `Docs/Backend.md`, `Docs/Agent.md`, `Docs/Onboarding.md`, checklists to match the new reality.

2. Run full verification:
   - `bun run check` from repo root passes
   - `bun run --cwd server build` succeeds
   - `bun run --cwd web build` succeeds
   - Manual E2E: open project, add provider key, start session, prompt agent to modify file, confirm change in ephemeral (not repo), promote, confirm commit on repo

## Out of scope (this pass)

- Terminal WebSocket (`/api/term`)
- Attachments API (`/api/attachments`)
- Git mutations (stage/commit/push/pull/checkout)
- Branch/PR diff-compare
- Hosted mode
- `desktop/` changes

## Constraints

- Do not modify `desktop/` in this pass
- Do not add dependencies beyond `@mariozechner/pi-coding-agent`, `@gittrix/core`, `@gittrix/adapter-local`
- Do not invent new API routes beyond what's specified
- Do not change frontend routing or surface structure
- If pi's library API differs from what this doc assumes, **stop and report** — do not improvise
- If GitTrix's API differs from what this doc assumes, **stop and report**
