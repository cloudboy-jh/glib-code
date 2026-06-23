// Convert pi's line-number diff format (from tool result `details.diff`) into a
// unified patch that pierre/diffs can render.
//
// Input lines look like:
//   "  1 context line"   → context
//   "+ 3 added line"     → addition
//   "- 3 removed line"   → deletion
//   "..."                → skipped (gap marker)
export function detailsDiffToUnifiedPatch(diff: string, filePath: string): string {
  const lines = diff.split("\n");
  const hunks: string[] = [];
  let oldLine = 1;
  let newLine = 1;
  let hunkOldStart = -1;
  let hunkNewStart = -1;
  const hunkLines: string[] = [];

  function flushHunk() {
    if (!hunkLines.length) return;
    const addCount = hunkLines.filter((l) => l.startsWith("+")).length;
    const delCount = hunkLines.filter((l) => l.startsWith("-")).length;
    const ctxCount = hunkLines.filter((l) => l.startsWith(" ")).length;
    hunks.push(`@@ -${hunkOldStart},${ctxCount + delCount} +${hunkNewStart},${ctxCount + addCount} @@`);
    hunks.push(...hunkLines);
    hunkLines.length = 0;
    hunkOldStart = -1;
    hunkNewStart = -1;
  }

  for (const raw of lines) {
    // skip trailing ellipsis / gap markers
    if (/^\s*\.\.\./.test(raw)) continue;

    const addMatch = raw.match(/^\+\s*(\d+) (.*)$/);
    const delMatch = raw.match(/^-\s*(\d+) (.*)$/);
    const ctxMatch = raw.match(/^\s{2}(\d+) (.*)$/);

    if (addMatch) {
      const lineNum = Number(addMatch[1]);
      if (hunkOldStart < 0) { hunkOldStart = oldLine; hunkNewStart = lineNum; }
      hunkLines.push(`+${addMatch[2]}`);
      newLine = lineNum + 1;
    } else if (delMatch) {
      const lineNum = Number(delMatch[1]);
      if (hunkOldStart < 0) { hunkOldStart = lineNum; hunkNewStart = newLine; }
      hunkLines.push(`-${delMatch[2]}`);
      oldLine = lineNum + 1;
    } else if (ctxMatch) {
      const lineNum = Number(ctxMatch[1]);
      // gap in context = flush previous hunk and start fresh
      if (hunkLines.length && lineNum > oldLine + 1 && lineNum > newLine + 1) {
        flushHunk();
      }
      if (hunkOldStart < 0) { hunkOldStart = lineNum; hunkNewStart = lineNum; }
      hunkLines.push(` ${ctxMatch[2]}`);
      oldLine = lineNum + 1;
      newLine = lineNum + 1;
    }
  }
  flushHunk();

  if (!hunks.length) return "";
  const fname = (filePath || "file").replace(/\\/g, "/");
  return `diff --git a/${fname} b/${fname}\n--- a/${fname}\n+++ b/${fname}\n${hunks.join("\n")}`;
}
