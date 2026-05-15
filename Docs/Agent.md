# Agent Integration

Last updated: 2026-05-15

## Runtime model

- Agent execution uses pi RPC over LF-delimited JSONL by default instead of calling pi as an in-process SDK.
- `server/src/services/agent-runtime.ts` owns runtime turn execution and SSE fanout.
- `server/src/services/session-resolver.ts` owns hardened session-id plus project-path lookup for agent/session routes.
- `server/src/services/pi-rpc.ts` owns pi's stdin/stdout protocol only.
- `server/src/services/sandbox.ts` owns where pi runs. GitTrix still owns storage boundaries and promote.
- The sandbox/RPC path is the default. Set `GLIB_PI_RUNTIME=sdk` to use the old in-process SDK fallback during parity testing.

## Sandbox abstraction

- `LocalSandbox` wraps local process spawn and filesystem access. Its cwd is the GitTrix local ephemeral workspace.
- `CloudflareSandbox` wraps the Cloudflare Sandbox SDK. Its cwd is sandbox-local (`/workspace`) and the hosted sync/promote path is still downstream.
- Consumers receive a `Sandbox` and do not branch on local vs hosted.

## Session isolation model

- Each glib session is paired with a GitTrix session.
- GitTrix returns `ephemeralPath`; local RPC sessions run pi there only when session metadata says it is git-backed and `.git` exists.
- Local GitTrix ephemeral workspaces are git-backed using detached worktrees with clone fallback.
- Old/non-git sessions still fall back to the durable repo path so shell git commands do not fail with `not a git repository`.
- Agent prompts include session repo metadata: durable path, actual cwd, GitTrix ephemeral workspace, workspace kind, git-backed state, and baseline SHA.
- Accepted changes move to durable only through explicit promote.
- GitTrix interfaces/adapters are unchanged by the RPC runtime work.
- Session-scoped agent actions resolve through `sessionId` plus the active session `projectPath`. The session index is still used first, but project path is sent to prevent stream/send 404s after reloads, project switches, or stale index state.

## Pi RPC protocol

- One JSON object per LF-terminated line on stdout.
- The parser is chunk-safe and uses strict LF splitting. It does not use Node `readline`.
- Unicode line/paragraph separator characters inside JSON strings do not split events.
- Commands are written to stdin as JSONL through a serialized write queue.
- Current default invocation is `pi --mode rpc --no-session`; override with `GLIB_PI_RPC_CMD` and `GLIB_PI_RPC_ARGS` if needed.
- `pi-rpc.ts` treats `agent_end` as the completion signal for a prompt. `turn_end` is only one model/tool cycle and must not resolve the prompt early.
- `agent-runtime.ts` also extracts final assistant text from `agent_end.messages` if streaming deltas did not deliver it.

## Provider auth flow

- Local SDK/discovery still uses glib's pi auth file at `<configDir>/pi/auth.json`.
- RPC spawn injects the selected provider key into the pi subprocess env (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.).
- Keys are not written to sandbox disk.

## Event flow

```txt
pi subprocess in sandbox
  -> JSONL stdout
  -> pi-rpc.ts PiEvent
  -> agent-runtime.ts mapPiEvent
  -> shared AgentEvent
  -> persisted timeline + SSE broadcast
```

`AgentEvent` stays stable so the frontend does not care whether events came from SDK callbacks or RPC stdout.

Text chunk events use collision-proof part IDs. Do not derive `text_part.partId` from wall-clock time because pi can emit several deltas in the same millisecond and the frontend dedupes by event identity.

## Abort and dispose

- Abort calls the active runtime's abort method. In RPC mode that writes an abort command to pi stdin and waits briefly for ack/abort/end.
- Abort does not kill the subprocess.
- Session delete disposes the RPC client and destroys the sandbox.

## Failure modes

- Sandbox creation failure: `SANDBOX_START_FAILED` error path.
- pi binary missing/spawn failure: `SANDBOX_PI_MISSING` when detectable from spawn error text.
- pi process exits mid-turn: canonical `error` event with `name: "pi_crashed"`.
- pi process exits between turns: the next turn respawns pi inside the same sandbox path.
- RPC parse error: logged and skipped; the stream stays alive.
- stdin write failure: treated as runtime failure for the turn.

## Restart behavior

- Session metadata and event timelines persist under repo-local `.glib/sessions`.
- Session ID to durable project path lookup persists in app config at `<configDir>/sessions-index.json`.
- Live SDK sessions, subprocesses, and sandboxes do not survive server restart.
- First send after restart creates a fresh runtime for the existing session metadata.
- Existing session actions continue to target the persisted repo-local session through session-id lookup plus project-path fallback.

## Active gaps

- Finish authenticated prompt/abort smoke coverage against an installed pi binary.
- Add regression coverage for duplicate session creation and session stream reconnect/stale behavior.
- Complete real Cloudflare Sandbox integration once hosted deployment work starts.
- Add hosted sync between sandbox filesystem and Cloudflare Artifacts before promote, unless a native mount path is verified.
