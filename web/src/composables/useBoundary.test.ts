import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { BoundaryPayload } from '@glib-code/shared/events/agent';
import { useBoundary } from './useBoundary';

function pendingPayload(overrides: Partial<BoundaryPayload> = {}): BoundaryPayload {
  return {
    state: 'pending',
    touchedFiles: ['src/a.ts'],
    touchedFileCount: 1,
    additions: 5,
    deletions: 2,
    baselineSha: 'abc1234',
    lastPromotedAt: null,
    promoteHistory: [],
    ...overrides,
  };
}

describe('useBoundary.applyBoundaryEvent', () => {
  beforeEach(() => {
    // refresh() on the immediate watch fires a fetch; stub it so it no-ops.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('applies a boundary_changed payload for the active session', () => {
    const { boundary, applyBoundaryEvent } = useBoundary({
      sessionId: () => 's1',
      projectPath: () => null,
      isSessionActive: () => false,
    });

    applyBoundaryEvent({ ...pendingPayload(), sessionId: 's1' });

    expect(boundary.value.state).toBe('pending');
    expect(boundary.value.touchedFiles).toEqual(['src/a.ts']);
    expect(boundary.value.additions).toBe(5);
    expect(boundary.value.deletions).toBe(2);
  });

  it('ignores events targeting a different session', () => {
    const { boundary, applyBoundaryEvent } = useBoundary({
      sessionId: () => 's1',
      projectPath: () => null,
      isSessionActive: () => false,
    });

    applyBoundaryEvent({ ...pendingPayload(), sessionId: 's2' });

    expect(boundary.value.state).toBe('no_workspace');
    expect(boundary.value.touchedFiles).toEqual([]);
  });

  it('hydrates when projectPath resolves after the sessionId (reload race)', async () => {
    // On a full reload the sessionId is set before the session doc / project
    // path resolve. The composable must hydrate once the prerequisites land,
    // not stay empty forever.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => pendingPayload(),
    });
    vi.stubGlobal('fetch', fetchMock);

    let projectPath: string | null = null;
    let active = false;
    const sessionId = () => 's1';
    const { refresh } = useBoundary({
      sessionId,
      projectPath: () => projectPath,
      isSessionActive: () => active,
    });

    // Immediate watch ran with null projectPath → no fetch yet.
    expect(fetchMock).not.toHaveBeenCalled();

    // Prerequisites resolve; consumer re-triggers (mirrors reactive deps).
    projectPath = '/repo';
    active = true;
    await refresh();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('does not clobber state during a promote animation', async () => {
    vi.useFakeTimers();
    const { boundary, applyBoundaryEvent, onPromoteComplete } = useBoundary({
      sessionId: () => 's1',
      projectPath: () => null,
      isSessionActive: () => false,
    });

    const promote = onPromoteComplete();
    // Mid-animation a stream event arrives — must be ignored.
    applyBoundaryEvent({ ...pendingPayload(), sessionId: 's1' });
    expect(boundary.value.state).not.toBe('pending');

    await vi.runAllTimersAsync();
    await promote;
  });
});
