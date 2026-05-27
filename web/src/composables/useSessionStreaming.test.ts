import { describe, expect, it, vi } from 'vitest';
import { useSessionStreaming } from './useSessionStreaming';

describe('useSessionStreaming', () => {
  it('marks session stale when reconnect hydration fails', async () => {
    const staleSessionIds = new Set<string>();
    const sessionNoticeById: Record<string, string | undefined> = {};
    const statuses: Record<string, string> = {};
    const streamsBySessionId = new Map<string, EventSource>();
    const streamErrorCountBySessionId = new Map<string, number>();

    const streaming = useSessionStreaming({
      apiBase: 'http://localhost:5050/api',
      sessions: [{ id: 's1', projectPath: 'c:/repo/app', status: 'connected' }],
      state: { activeSessionId: 's1' },
      streamsBySessionId,
      streamErrorCountBySessionId,
      staleSessionIds,
      sessionNoticeById,
      setSessionStatus: (sessionId, status) => {
        statuses[sessionId] = status;
      },
      reduceAgentEventToTimeline: () => undefined,
      hydrateSessionDoc: vi.fn().mockRejectedValue(new Error('not found'))
    });

    await streaming.confirmAndMarkSessionStale('s1', 'Session stream disconnected');

    expect(staleSessionIds.has('s1')).toBe(true);
    expect(statuses.s1).toBe('stale');
    expect(sessionNoticeById.s1).toBe('Session stream disconnected');
  });
});
