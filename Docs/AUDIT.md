# glib-code audit (grounded)

Last updated: 2026-07-10  
Scope: tree at `main` (`7d58e16` vicinity), first-party source only (excludes `node_modules`, `dist`, `dist-app`).  
Method: inventory + layout + tests + CI/docs cross-check. Not a vibe/scorecard pass.

## Product thesis (still sound)

Isolated agent workspaces, review before promote, durable repo touched only by acceptance. Stack matches docs: Bun + Hono (`server/`), Vue 3 + Vite (`web/`), Electron (`desktop/`), contracts in `shared/`, isolation/promote via GitTrix, agent runtime via pi RPC subprocess.

That loop is the asset. Everything else is packaging, decomposition, and proof.

## Size (measured, not marketable)

| | Count / note |
|---|---|
| First-party files | ~215 |
| TypeScript | 89 |
| Vue | 56 |
| Markdown | ~22 |
| App code lines (ts/vue/js/css, non-empty) | ~19k; crude comment density ~5–6% |
| First-party `*.test.ts` | 19 (server-heavy; some web vitest) |
| Package versions | 1.0.0 across workspaces |
| Tags | `v1.0.0` present (plus older `v0.1.x`) |

Prior “17,464 LOC / 217 files / 91 TS / 7% comments / v1.0.1” style stats are approximate tourism, not a ledger. Do not re-paste them.

Exact-content “dupes” found: iconset @2x aliases, tray icons, logo copied into `web/public`. Not logic duplication. Ignore as a size crisis.

## Architecture reality

### Good

- Clean workspace split and root scripts (`dev`, `build`, `check`, `test`).
- Server domain routes + services (`session-store`, `session-resolver`, `agent-runtime`, `sandbox`, `pi-rpc`, GitTrix shims).
- Explicit promote/session contracts and route tests around them.
- Two-stage release workflow (bun build → node/electron-builder package win/mac/linux).
- Living product docs under `Docs/` (SPEC, Architecture, Frontend/Backend/Agent, Onboarding, smoke checklist).

### Not good enough

1. **Frontend still centers on a god file.**  
   `web/src/App.vue` ≈ **3358** lines. Composables and `views/{Picker,Session,Diff}View.vue` exist, but ownership never left App. Older `Docs/architecture-audit.md` (2026-05-27) already warned at ~2.3k; that got worse, not better. Hot companions: `DiffWorkbench.vue` ~1160, `agent-runtime.ts` ~838, `routes/sessions.ts` ~445.

2. **Session path is real but was misrepresented elsewhere.**  
   There is no `server/src/sessions/*`. Load-bearing surface is:
   - `routes/sessions.ts`, `routes/agent.ts`
   - `services/session-store.ts`, `session-resolver.ts`, `session-export.ts`, `agent-runtime.ts`, `sandbox.ts`, `pi-rpc.ts`
   Docs for invariants come from `Docs/Agent.md`, `Docs/api-contracts.md`, route tests — not from missing JSDoc quota.

3. **CI is release packaging, not continuous quality.**  
   Only `.github/workflows/release.yml` (tag `v*`). No PR workflow for `bun run check` / `bun test`. Root test script and green history exist (`Docs/1.0release.md`: ~198 server suite + 25 web); bridge them into CI or they are local folklore.

4. **Ship docs disagree with ship machinery.**  
   - `Docs/RELEASE.md`: Mac DMG + Windows ZIP, no Linux, manual host builds, “no signing/notarization.”  
   - Live workflow: windows/mac/linux package jobs; notarize hooks commented as optional secrets.  
   - README promises three download names at 1.0.0 — verify against actual GH Release assets.  
   Stale/ship-drift docs erase trust faster than missing CONTRIBUTING.md.

5. **Stale doc graph.**  
   `Docs/SPEC.md` still lists sources that are gone (`next-steps.md`, `frontend-checklist.md`, `backend-checklist.md`). Architecture audit is half-executed history, not current map. Prefer one current audit (this file) + SPEC/Architecture over checklist sprawl.

6. **Distribution friction is deliberate, not a surprise.**  
   Unsigned/unnotarized Mac is documented debt. Fix when user sink matters; after truthful smoke + CI, not instead of them.

7. **Deferred product risk still in tree.**  
   Cloudflare remote sandbox path, skills, hosted web/backend — out of 1.0 scope by design (`Docs/1.0release.md`). Keep them out of “production-ready” claims until they are either deleted or hard-gated + tested.

## What is *not* a top priority

- Raising comment density to 15% via JSDoc drives. Prefer invariants + tests + short contract notes on tricky paths.
- “Audit duplicate files” across the repo (icons will clown the tool).
- Folding every tsconfig into one file (already have `tsconfig.base.json`).
- CONTRIBUTING.md as phase-1 leverage (one contributor, clear monorepo scripts; write it when a second human arrives).
- Coverage badge without PR CI.

## Ranked work (do in order)

| # | Work | Done when |
|---|---|---|
| 1 | **Bleed `App.vue`** into composables/views already started; say target <800 lines, no session/stream mutations left in the root SFC | Unit/integration tests cover create/select/stream/promote/recovery without mounting the whole tree |
| 2 | **PR CI** | On PR/push to main: `bun run check` + full root `test` succes; release job remains tag-only |
| 3 | **Isolation & promote proof** | Owner smoke in `Docs/session-smoke-test.md` green; extend tests for baseline drift, path scoping, stream reconnect, duplicate create prevention where missing |
| 4 | **Truthful release surface** | One `Docs/RELEASE.md` matching workflow + actual artifacts; README table verified; notarize stays explicit follow-on |
| 5 | **Doc garbage collection** | SPEC source list fixed; point at this AUDIT; archive or date-stamp obsolete checklist claims in `architecture-audit.md` |

Notarize Mac only after 2–4 if non-technical Mac users are a real channel. Otherwise leave it listed, not half-started.

## Honest posture (no scorecard)

glib-code is a **coherent, shippable-shaped 1.0 product monorepo** with a sharp isolation/promote thesis, real server tests, and serious packaging intent. It is **not** a polished multi-contributor production platform: frontend weight is still concentrated, quality gates stop at the laptop, and release/docs truth is uneven.

Lead with decomposition + CI + boundary proof. Do not spend a sprint on comment quotas, md5 theater, or mid-priority CONTRIBUTING cosmetics.

## How this supersedes the generic review

Discard external scorecards that invent paths (`server/src/sessions/*`), wrong versions (`v1.0.1`), and high-prio “dupes.” Keep only what survives contact with the tree. This file is the current audit artifact; update it when the ranked table moves.

## Key paths for the next pass

```
web/src/App.vue
web/src/composables/useSessionOrchestrator.ts
web/src/composables/useSessionStreaming.ts
web/src/views/*
server/src/services/agent-runtime.ts
server/src/services/session-store.ts
server/src/routes/sessions.ts
.github/workflows/release.yml
Docs/session-smoke-test.md
Docs/1.0release.md
Docs/RELEASE.md
Docs/Agent.md
Docs/SPEC.md
```
