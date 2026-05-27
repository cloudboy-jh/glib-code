# Architecture Audit (Frontend + Server)

Last updated: 2026-05-27 (Phase 4 complete)

## Executive summary

- `web/src/App.vue` is carrying too much responsibility (2314 lines, ~145 state/computed/function/watch declarations).
- Server boundaries are mostly sane by route domain, but session/project-path semantics are spread across routes + resolver + store and need contract hardening.
- Refactor should be phased as **move-only first**, then composables, then contract cleanup/tests.

## Current architecture map

### Frontend

- Entry orchestrator: `web/src/App.vue`
- Surface components:
  - Picker: `components/picker/*`
  - Session: `components/session/*`
  - Diff: `components/diff/*`
  - Settings/overlays: `components/settings/*`, `components/app/*`

`App.vue` currently owns all of this in one place:

- app shell layout + sidebar resize/collapse
- mode routing (`picker`/`diff`/`session`)
- session hydration/listing/selection/create/delete/export/promote
- picker session catalog hydration (`/sessions?scope=all`)
- SSE stream lifecycle + event reduction
- recents/project open flow
- provider/auth/settings/git status flows
- keyboard handlers + overlay control
- API helpers (`apiGet/apiPost/apiPatch/apiDelete/apiBlob`)

### Server

- Route mount: `server/src/routes/index.ts`
- Domain routes:
  - project lifecycle: `routes/projects.ts`
  - session metadata/export/diff/promote: `routes/sessions.ts`
  - agent runtime send/stream/abort: `routes/agent.ts`
  - provider/auth/settings: `routes/providers.ts`, `routes/auth.ts`, `routes/settings.ts`
  - diff/git/fs/readiness/term/attachments: dedicated routes

Service boundaries:

- session persistence: `services/session-store.ts`
- session/projectPath resolution: `services/session-resolver.ts`
- runtime orchestration: `services/agent-runtime.ts`
- project recents/current/open state: `services/project-store.ts`, `services/projects.ts`
- diff + gittrix + provider capabilities: dedicated services

## Pain points (ranked)

### High risk

- **God component risk in `App.vue`**
  - hard to reason about state transitions
  - easy to regress unrelated flows
  - difficult to test flow logic without rendering whole app

- **Session scoping semantics are distributed**
  - `/api/sessions` scoped vs `/api/sessions?scope=all` global behavior now exists, but contract is implicit in code/docs and not centralized.

- **Path normalization duplication**
  - frontend canonicalization and server normalization are not shared and may drift (case, slashes, trailing slash behavior).

### Medium risk

- **Route-level error envelope inconsistency**
  - some routes use `{ok:false,code,message,retryable}`, others return ad-hoc `{ok:false,message}`.

- **Global keyboard/overlay precedence is cross-cutting in `App.vue`**
  - easy to break with new dialogs/surfaces.

### Low risk

- **Naming/layout debt**
  - missing `views/` layer makes intent fuzzy (surface orchestration vs UI component).

## Refactor target shape

### Frontend target

Add `web/src/views/`:

- `views/PickerView.vue`
- `views/SessionView.vue`
- `views/DiffView.vue`

Add composables:

- `useSessionOrchestrator.ts`
  - hydrate/create/select/delete/export/promote
  - continue/new from picker
- `useSessionStreaming.ts`
  - connect/disconnect/retry/stale
  - event reduction wiring
- `usePickerSessions.ts`
  - recents + global picker sessions + path mapping
- `useGlobalShortcuts.ts`
  - key handling + overlay precedence
- `useApiClient.ts`
  - api helper methods + uniform request error translation

Keep `App.vue` as coordinator only:

- shell layout
- current mode/view selection
- top-level modal mounting
- prop/event wiring between views and composables

### Server target

- Keep route domain split, but harden contracts:
  - document and enforce session list scoping explicitly
  - normalize error envelope consistently on all routes
  - centralize path canonicalization semantics (single utility used by resolver/store)
- Add response shape tests for scoped/global session listing and path edge cases.

## Phased implementation plan (rollback-safe)

### Phase 0: Contract freeze + baseline checks

- Capture baseline behavior:
  - `bun run --cwd web check`
  - relevant server tests (`session-routes`, resolver/store tests)
- Write/confirm short API contract note for sessions list scoping.

### Phase 1: Move-only frontend extraction (no behavior changes)

- Create `views/PickerView.vue`, `views/SessionView.vue`, `views/DiffView.vue`.
- Move template chunks out of `App.vue` into views.
- Keep logic in `App.vue`; pass props/emit events only.

Checkpoint: app behavior unchanged; typecheck passes.

### Phase 2: Composable extraction

- Extract session orchestration + streaming + picker-session hydration + shortcuts + api client.
- Replace direct local state mutation patterns with composable APIs.

Checkpoint: same UX flows, cleaner state seams, typecheck + tests pass.

### Phase 3: Server contract hardening

- Introduce shared route error helper for consistent payloads.
- Consolidate canonical path behavior in one utility imported by resolver/store/routes.
- Extend tests for path edge cases and scoped/global listing guarantees.

Checkpoint: route contracts explicit, tests cover old failure classes.

### Phase 4: UX polish + regression suite

- Final keyboard/overlay precedence pass.
- Add focused frontend regression coverage for picker/session path + list cap + stale recovery.

Checkpoint: parity checklist items can be closed with confidence.

## Suggested work order (file-by-file)

1. `web/src/views/*` (new) + minimal `App.vue` template rewiring
2. `web/src/composables/useApiClient.ts` (new) and migrate API calls
3. `web/src/composables/usePickerSessions.ts` (new)
4. `web/src/composables/useSessionOrchestrator.ts` (new)
5. `web/src/composables/useSessionStreaming.ts` (new)
6. `web/src/composables/useGlobalShortcuts.ts` (new)
7. Server utilities for canonical path + route error envelope
8. Expand `server/src/routes/*test.ts` coverage for contract assertions

## Non-goals for this refactor

- No router migration.
- No UI redesign.
- No data model rewrite.
- No GitTrix provider behavior changes beyond contract/normalization hardening.

## Completion snapshot

- Phase 1 completed: view extraction to `web/src/views/{PickerView,SessionView,DiffView}.vue`.
- Phase 2 completed: composable extraction to `useApiClient`, `usePickerSessions`, `useSessionStreaming`, `useSessionOrchestrator`, `useGlobalShortcuts`.
- Phase 3 completed: shared route error envelope utility + centralized server path canonicalization + scoped/global session route coverage.
- Phase 4 completed: overlay precedence hardening and frontend regression suite for picker/session list caps, canonical grouping, and stale-session fallback.

## Post-phase fix

- Fixed startup crash in `App.vue` caused by referencing `sessionOrchestrator` before initialization (temporal dead zone), which produced an instant blank screen.
