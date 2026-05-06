# feat: pi RPC + sandbox execution layer

Status: proposed
Owner: Jack
Last updated: 2026-05-06

## Goal

Replace the in-process pi-coding-agent SDK runtime in `server/src/services/agent-runtime.ts` with a pi RPC subprocess running inside a pluggable sandbox. Two sandbox implementations: local subprocess (desktop) and Cloudflare Sandbox (hosted). Leave GitTrix entirely alone — it stays the storage router for ephemeral workspaces, this work is execution-layer only.

## Non-goals

- No changes to GitTrix interfaces, adapters, durable/ephemeral contracts, or promote flow.
- No changes to `LocalDurableAdapter`, `GitHubDurableAdapter`, `LocalEphemeralAdapter`, `CloudflareArtifactsEphemeralAdapter`. They stay exactly as-is.
- No new product surfaces. PROJECTS / DIFF / GIT / PI mode parity with glib TUI is a separate feat.
- No mode renaming in the UI. "Session" stays "Session" in glib-code for now.
- No hosted deployment in this feat. This feat lands the abstraction + local impl + a CF Sandbox impl that's testable but not deployed.

## Why

Current `agent-runtime.ts` imports `@mariozechner/pi-coding-agent` and calls `createAgentSession` in-process with `cwd` set to a local filesystem path. This works on desktop. It does not work on Cloudflare Workers — the Worker can't `cwd` into a remote workspace, and pi's tools (`bash`, `read`, `write`, `edit`) need real filesystem and process primitives.

Pi has an RPC mode (LF-delimited JSONL over stdin/stdout) that's designed exactly for this case: pi runs as a subprocess, host parses events. glib TUI already uses pi RPC in its PI mode. We port that pattern into glib-code's server.

Once pi is a subprocess, *where* the subprocess runs becomes the only thing that varies between desktop and hosted. That's the sandbox layer.

## Scope
server/src/services/agent-runtime.ts        rewrite
server/src/services/pi-rpc.ts                new
server/src/services/sandbox.ts               new (interface + LocalSandbox)
server/src/services/sandbox-cloudflare.ts    new (CloudflareSandbox impl)
server/src/routes/agent.ts                   light edits (callsite changes only)
server/src/services/sessions.ts              no changes expected
server/src/services/gittrix.ts               no changes
server/src/services/gittrix-local-adapter.ts no changes
server/src/services/gittrix-cloud-adapters.ts no changes
shared/src/events/agent.ts                   no changes (AgentEvent shape stays)
Docs/Agent.md                                rewrite
Docs/Backend.md                              edit (agent + execution sections only)
Docs/SPEC.md                                 small edit (substrate paragraph)
Docs/next-steps.md                           edit (reorder priorities)
Docs/backend-checklist.md                    edit (mark new items, retire old)

Touch nothing in `web/` for this feat. The frontend already speaks `AgentEvent` over SSE; the source of those events changes, the events themselves don't.

## Architectural shape

Two new layers, one rewritten layer.

### Layer 1: Sandbox

`server/src/services/sandbox.ts`

A sandbox is an execution environment with a filesystem and the ability to spawn processes. Not storage. Not GitTrix. Just "where can I run pi?"

```ts
export interface Sandbox {
  id: string;
  cwd: string;
  spawn(opts: SpawnOpts): Promise<SandboxProcess>;
  writeFile(path: string, contents: Uint8Array): Promise<void>;
  readFile(path: string): Promise<Uint8Array>;
  destroy(): Promise<void>;
}

export interface SpawnOpts {
  cmd: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface SandboxProcess {
  stdin: WritableStream<Uint8Array>;
  stdout: ReadableStream<Uint8Array>;
  stderr: ReadableStream<Uint8Array>;
  exitCode: Promise<number>;
  kill(signal?: "SIGTERM" | "SIGKILL"): Promise<void>;
}

export interface SandboxFactory {
  create(opts: { sessionId: string; cwd: string }): Promise<Sandbox>;
}
```

Two implementations:

**`LocalSandbox`** — wraps Node `child_process.spawn` and `node:fs`. The `cwd` is a real filesystem path. This is the desktop case. The local sandbox's filesystem *is* the user's machine.

**`CloudflareSandbox`** — wraps `@cloudflare/sandbox` SDK. The `cwd` is a path inside the sandbox container. Filesystem operations go through the SDK. Process spawning uses the SDK's `exec` with bidirectional streaming (PTY mode if needed for stdin/stdout RPC).

Selection happens at the factory level based on env. No conditional logic inside services that consume the sandbox.

### Layer 2: pi RPC client

`server/src/services/pi-rpc.ts`

A pi RPC client takes a `SandboxProcess` (already spawned, running pi in RPC mode) and exposes a session-shaped API that mirrors the relevant subset of the SDK's `AgentSession`. This is the only file that knows pi's protocol.

```ts
export interface PiRpcClient {
  prompt(text: string, opts?: { context?: string }): Promise<void>;
  abort(): Promise<void>;
  subscribe(handler: (event: PiEvent) => void): () => void;
  dispose(): Promise<void>;
}

export function attachPiRpc(process: SandboxProcess, opts: PiRpcOpts): PiRpcClient;
```

`PiEvent` is pi's native event taxonomy. The mapping to glib's `AgentEvent` lives one layer up, in `agent-runtime.ts`. Don't conflate the two — pi events are the wire protocol, AgentEvent is glib's persisted/streamed shape.

Implementation rules, all of which come from glib TUI's existing RPC client and pi docs:

- Strict LF-only line splitting. Never use Node `readline`. JSON payloads contain Unicode separators that `readline` will split on incorrectly.
- One JSON object per line, no exceptions.
- Maintain a write queue for stdin. Pi RPC commands (prompt, abort, etc.) go in as JSONL, one line each.
- Backpressure on the read side: if the consumer's handler is slow, buffer events but don't drop. SSE downstream handles flow control.
- Abort sends pi's abort RPC command, then waits for the corresponding ack event before resolving.
- `dispose()` closes stdin, waits a short grace period for pi to flush, then kills the subprocess.

### Layer 3: agent-runtime rewrite

`server/src/services/agent-runtime.ts`

Stops importing `@mariozechner/pi-coding-agent`. Stops calling `createAgentSession`. Becomes:

1. On session create, ask the sandbox factory for a sandbox at the session's `ephemeralPath`.
2. Spawn pi inside the sandbox in RPC mode (`pi --rpc` or whatever the flag is — pin the exact invocation in code).
3. Inject the user's provider API key as an env var on the spawn — `setRuntimeApiKey` equivalent, never persisted to sandbox disk.
4. Inject the repo-boundary instruction as the session's first system message (lift verbatim from glib TUI).
5. Wrap the spawned process in `attachPiRpc`.
6. Subscribe to pi events, map each to `AgentEvent`, persist via `appendEvents`, broadcast via `broadcast`.
7. Hold the `PiRpcClient` in a session map keyed by `sessionId` so `runTurn` and `abortRunningTurn` find it.
8. On session delete or evict, call `dispose()` then `sandbox.destroy()`.

The mapping logic in `mapPiEvent` stays — that function already does pi-event-to-AgentEvent translation. It just gets fed from RPC instead of SDK callbacks.

The `getOrCreateRuntimeSession` function goes away. Replaced by `getOrCreateSandboxSession`. Same shape, different internals.

`runtimeSessions` map gets renamed to `sandboxSessions`. Entry shape:

```ts
type SandboxSession = {
  sandbox: Sandbox;
  process: SandboxProcess;
  pi: PiRpcClient;
  cwd: string;
};
```

## Sandbox + GitTrix interaction

This is the part that has to be exactly right or the whole thing collapses.

GitTrix already creates an ephemeral workspace and gives back `ephemeralPath`. The code in `gittrix.ts` does this via `startSession`, returning `{ gittrixSessionId, ephemeralPath, baselineSha }`.

`ephemeralPath` is **a string the sandbox interprets**. It's not necessarily a real filesystem path — for `LocalEphemeralAdapter` it is, for `CloudflareArtifactsEphemeralAdapter` it's some Artifacts-side identifier.

For LocalSandbox + LocalEphemeralAdapter: `ephemeralPath` is a real local path, sandbox `cwd` = that path, pi writes land in that path, GitTrix sees the writes when computing the diff. Already works.

For CloudflareSandbox + LocalEphemeralAdapter: doesn't make sense. Skip this combo. Hosted means non-local everything.

For CloudflareSandbox + CloudflareArtifactsEphemeralAdapter: `ephemeralPath` is an Artifacts identifier, *not* a path inside the CF Sandbox container. The sandbox has its own filesystem. Two options:

- **Option A**: pi writes into the sandbox's own filesystem (e.g. `/workspace`). On promote, GitTrix needs to read those files. Either GitTrix's `CloudflareArtifactsEphemeralAdapter` learns to pull from the sandbox, or we add a sync step before promote.
- **Option B**: mount Artifacts as a filesystem inside the sandbox (CF Sandbox SDK supports R2-as-filesystem; check whether it supports Artifacts the same way). Pi writes through the mount, GitTrix reads from Artifacts as before.

Option B is cleaner if the SDK supports it for Artifacts. Option A is more flexible but adds a sync step.

**Decision required before coding hosted path**: confirm whether Cloudflare Sandbox SDK supports mounting Artifacts as a filesystem. If yes, Option B. If no, Option A with a documented sync step in `agent-runtime.ts` between turn-end and promote.

For this feat, ship Option A. It works without depending on a feature we haven't verified, and it keeps the hosted path testable without committing to a mount strategy.

## Pi binary distribution

LocalSandbox: pi installed on the user's machine (already required today). No change.

CloudflareSandbox: pi needs to be available inside the container image. Two paths:

- Bake pi into a custom container image used by `@cloudflare/sandbox`. Requires a Dockerfile and a build/publish step.
- `npm install -g @mariozechner/pi-coding-agent` at sandbox start. Adds 5-15s to cold start.

For this feat, npm-install at start. Ship the Dockerfile path as a follow-up. The cold-start cost only hits the first turn and CF Sandboxes sleep/wake, so subsequent turns in the same session don't pay it.

## Provider auth in the sandbox

Today: provider keys live at `<configDir>/pi/auth.json` on the user's machine, pi reads them.

LocalSandbox: pi reads from the same auth path. No change.

CloudflareSandbox: pi inside the sandbox cannot read the user's local auth.json (there is no user machine). Inject the key at spawn:

```ts
sandbox.spawn({
  cmd: "pi",
  args: ["--rpc", "--no-session"],
  env: {
    ANTHROPIC_API_KEY: lookupKey(provider, sessionMeta.provider),
    // or OPENAI_API_KEY, etc., based on provider
  }
});
```

Pi's `AuthStorage` already falls back to env vars per its docs. This works without pi-side changes.

The key never persists to sandbox disk. When the sandbox is destroyed, the key vanishes with it.

For hosted with multi-user: future work. For this feat (single-user hosted), keys come from the same `<configDir>/pi/auth.json` on the Worker side, injected per-spawn.

## Routes

`server/src/routes/agent.ts` keeps its current shape. The handlers don't know whether they're talking to LocalSandbox or CloudflareSandbox — they call into `agent-runtime.ts`, which calls into the sandbox abstraction.

One small change: `POST /api/agent/sessions` currently calls `gittrix.startSession` then creates a session record. After this feat, it also calls `sandboxFactory.create(...)` and stores the sandbox handle. The order is:

1. Validate provider/model
2. `gittrix.startSession` → get `ephemeralPath`
3. `sandboxFactory.create({ sessionId, cwd: ephemeralPath })` → get `Sandbox`
4. Spawn pi in the sandbox, attach RPC client
5. Persist session metadata (existing flow)

Failures at step 3 or 4 return the same `GITTRIX_SESSION_START_FAILED`-style structured error envelope. Add a new `code: "SANDBOX_START_FAILED"` for sandbox-specific failures.

## Event flow

Before:
pi SDK in-process → emits AgentSessionEvent → mapPiEvent → AgentEvent
→ appendEvents (persist) + broadcast (SSE fanout)

After:
pi subprocess in sandbox → JSONL on stdout → pi-rpc.ts parses → PiEvent
→ mapPiEvent (in agent-runtime.ts) → AgentEvent
→ appendEvents (persist) + broadcast (SSE fanout)

The `mapPiEvent` function stays. Its input type changes from pi SDK's `AgentSessionEvent` to the slightly different RPC event shape. The output (`AgentEvent`) stays identical, so the frontend is unaffected.

Verify: the existing `eventKey` function in `web/src/App.vue` expects exact field names. Don't break those. AgentEvent contract is stable.

## Streaming and abort

The current implementation has known fragility around streamed-text reconciliation (`streamedTextByTurn`, `suffixFromFinal`). Pi RPC mode emits `text_delta` events that should be straightforward to accumulate without the SDK's message-end reconciliation dance. Drop the suffix-matching logic if RPC text events are clean. Keep it as a fallback if they aren't — verify against real pi RPC output during implementation.

Abort flow:

1. User triggers abort via `DELETE /api/agent/sessions/:id/turn`
2. Route handler calls `abortRunningTurn(sessionId)`
3. That looks up the `PiRpcClient` and calls `pi.abort()`
4. pi-rpc sends abort command over stdin, waits for ack
5. Pi emits `aborted` and `turn_end` events
6. Existing event flow takes over

No hard kill of the subprocess on abort. Subprocess survives across turns. Only `dispose()` (session delete) kills it.

## Failure modes

Document and handle each:

- **Sandbox factory fails to create** — return 500 with `code: "SANDBOX_START_FAILED"`, include underlying error message
- **pi binary not found in sandbox** — sandbox spawn fails with non-zero exit and stderr; surface as `SANDBOX_PI_MISSING`
- **pi crashes mid-turn** — subprocess exits with non-zero code while a turn is active; emit `error` AgentEvent with `name: "pi_crashed"`, then `turn_end` with `reason: "error"`
- **RPC parse error** — non-JSON line on stdout; log and skip the line, don't kill the turn
- **Stdin write fails (EPIPE)** — subprocess died; treat as crash, see above
- **Sandbox network failure (CF only)** — for CloudflareSandbox, network blip during exec; emit `error` event with `retryable: true`

## Tests

Hard requirements before merging:

- Unit test for `pi-rpc.ts`: feeds a fixture of JSONL bytes split across arbitrary chunk boundaries, asserts the same set of events come out regardless of chunking
- Unit test for `pi-rpc.ts`: asserts LF-only splitting (UTF-8 sequences containing Unicode separators don't fragment events)
- Unit test for `LocalSandbox`: spawn `cat`, write to stdin, read from stdout, kill, verify exitCode
- Integration test: full session lifecycle against a real local pi binary in a tmpdir, sending one prompt, asserting `text_part` events flow back, then aborting and asserting `aborted` + `turn_end`
- Existing route tests for `/api/agent/sessions` keep passing

CloudflareSandbox tests are best-effort for this feat — mock the `@cloudflare/sandbox` SDK in a unit test, real integration test deferred until hosted deployment.

## Migration path for in-flight sessions

Persisted session metadata (under `.glib/sessions/<id>.json`) doesn't change shape. `SessionMeta` already has `gittrixSessionId`, `ephemeralPath`, `baselineSha`. No migration needed.

On server restart, sandboxes are not preserved. Sessions resume their event history (already works) but have no live runtime. First send after restart spawns a new sandbox. This matches current behavior — the SDK runtime today is also lost across restarts.

Document this in `Docs/Agent.md`: "session timeline persists, sandbox does not."

## Doc updates required

`Docs/Agent.md` — full rewrite. New runtime model is RPC subprocess in sandbox. Sections:

- Runtime model (RPC subprocess in sandbox, replaces in-process SDK)
- Sandbox abstraction (interface, two impls, when each is used)
- Pi RPC protocol (link to pi.dev RPC docs, note our LF-only requirement)
- Repo-boundary instruction (lifted from glib TUI, injected at session start)
- Provider auth flow (env injection, no sandbox-side persistence)
- Failure modes
- What survives a server restart (events: yes, sandbox: no)

`Docs/Backend.md` — edit the "Agent integration point" section to reflect RPC-not-SDK. Edit the route table to note that `/api/agent/*` routes spawn sandboxes. No new routes.

`Docs/SPEC.md` — small edit to the architecture diagram and the "Current reality" section. The thesis doesn't change. Replace any mention of "pi as in-process library" with "pi as RPC subprocess in sandbox."

`Docs/next-steps.md` — reorder. Move "sandbox abstraction" to position 1. Move terminal WS, attachments, git mutations down by one each. Cloudflare Artifacts adapter line gets reframed: it's still GitTrix-side, separate from sandbox work.

`Docs/backend-checklist.md` — add new section "Sandbox + RPC runtime" with the items in this feat. Mark old "Replace subprocess runtime with pi in-process runtime" as superseded — flip it back, the in-process direction was wrong for hosted.

`Docs/onboarding.md` — note that pi must be installed on the user's machine for desktop (already true) and that hosted will install pi inside the sandbox automatically.

`README.md` — small edit to "Runtime boundaries" section. pi runs in sandbox now, not in-process.

## Build order

1. Land the sandbox interface + LocalSandbox impl (no pi yet, just process spawning)
2. Land pi-rpc client against a manually-spawned local pi process for testing
3. Wire LocalSandbox + pi-rpc into agent-runtime.ts, behind a feature flag (`GLIB_PI_RUNTIME=rpc` vs `sdk`)
4. Run both runtimes side-by-side until RPC is at parity, then flip default
5. Delete the SDK code path, drop `@mariozechner/pi-coding-agent` from dependencies (keep `@mariozechner/pi-ai` if anything still imports it; otherwise drop)
6. Land CloudflareSandbox impl
7. Update all docs in one commit at the end so docs reflect shipped reality, not aspirational state

Each step is independently reviewable and revertible.

## Open questions

These need answers before or during implementation. Not blockers for starting the feat, but must be resolved before the relevant step.

- **Pi RPC flag** — confirm exact pi CLI invocation for RPC mode. Docs say JSONL over stdin/stdout but the flag isn't pinned in this doc. Read pi-mono docs/rpc.md and lock it in `pi-rpc.ts` as a constant.
- **Pi RPC abort semantics** — does pi RPC have a structured abort command, or do we rely on SIGTERM? Affects `abort()` impl in pi-rpc.ts.
- **Pi RPC session continuation** — pi has `--session <id>` and `--fork <id>`. We don't use these yet. Decide whether each glib session = one pi RPC subprocess for the session's lifetime (likely yes), or whether we restart pi per turn with `--session` to resume. Yes-one-process is simpler; verify pi RPC handles multi-turn cleanly.
- **CloudflareSandbox PTY vs exec** — does `@cloudflare/sandbox`'s `exec` support full bidirectional stdin/stdout, or do we need PTY mode for pi RPC to work? Check the SDK before committing to an impl.
- **Repo hydration timing** — currently `gittrix.startSession` hydrates the ephemeral workspace. With LocalSandbox this is fine because the sandbox's cwd is the same path. With CloudflareSandbox, the sandbox is a separate filesystem; hydration might need to happen *inside* the sandbox via `git clone`. Document this in the CloudflareSandbox impl.

## Definition of done

- `LocalSandbox` spawns processes, does fs ops, destroys cleanly
- `pi-rpc.ts` parses real pi RPC output without losing events to chunking or Unicode
- `agent-runtime.ts` no longer imports `@mariozechner/pi-coding-agent` at runtime
- Existing session create → prompt → stream → abort → delete flow works end-to-end against pi RPC
- Frontend untouched, AgentEvent contract preserved, no UI regressions
- Tests in the section above all pass
- All listed doc files updated to reflect RPC-not-SDK reality
- `bun run check` and `bun run build` pass at workspace root
- One end-to-end manual smoke test with a real pi binary on local, walking the full PROJECTS → DIFF → start session → prompt → promote loop, recorded as a video or session log in the PR
A few notes on what I deliberately didn't do, in case any of them are wrong calls:

Didn't touch GitTrix. Per your correction. If any GitTrix changes are needed, they're a separate feat.
Didn't introduce a "PI mode" rename in the UI. That's a glib TUI concept and a different conversation.
Didn't include the Cloudflare deployment work. This feat lands the abstraction and a CF Sandbox impl. Actually deploying to a Worker and standing up a hosted instance is downstream.
Kept the feature flag step (item 3 in build order). That's the safest way to land a runtime swap without breaking your own daily driver. Drop it if you'd rather just rip the bandaid.