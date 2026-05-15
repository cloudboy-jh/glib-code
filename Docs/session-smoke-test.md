# Session Smoke Test

Use this after session/runtime/promote changes.

1. Restart app/backend fresh.
2. Open a repo and create a new session.
3. Ask `what repo are we in?`.
   - Expect a tool run followed by final assistant text.
   - Do not accept `Tool run completed, but the agent did not return a final answer.`
4. Ask `run git status and summarize`.
   - Expect final summary text.
   - Tool cwd should be the GitTrix workspace path.
5. Ask `make a tiny README edit`.
   - Expect the agent to edit and then summarize.
6. Click `Commit + Push`.
   - Expect a full-width session diff modal.
   - Button should be enabled when diff exists.
   - One-file diffs should not show a separate file sidebar.
7. Click `Commit all` or use the header file picker for a subset, then `Commit selected`.
   - Expect promote success with branch/SHA in timeline.
8. Refresh the app and reopen the same session.
   - Expect no duplicated timeline entries.
9. Ask `what did we change?`.
   - Expect the session to continue normally.
10. Restart backend/app, reopen the same repo/session, and send one more prompt.
    - Expect the session to recover instead of immediately going stale.
