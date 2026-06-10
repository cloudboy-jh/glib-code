import type { AgentEvent } from '@glib-code/shared/events/agent';

type SessionLike = { id: string; projectPath: string; status: 'connected' | 'connecting' | 'disconnected' | 'stale' | 'running' };

export function useSessionStreaming(options: {
  apiBase: string;
  sessions: SessionLike[];
  state: { activeSessionId: string };
  streamsBySessionId: Map<string, EventSource>;
  streamErrorCountBySessionId: Map<string, number>;
  staleSessionIds: Set<string>;
  sessionNoticeById: Record<string, string | undefined>;
  setSessionStatus: (sessionId: string, status: SessionLike['status']) => void;
  reduceAgentEventToTimeline: (sessionId: string, event: AgentEvent) => void;
  hydrateSessionDoc: (sessionId: string) => Promise<unknown>;
}) {
  function connectSessionStream(sessionId: string) {
    if (options.streamsBySessionId.has(sessionId)) return;
    if (!options.state.activeSessionId || options.state.activeSessionId !== sessionId) return;
    const session = options.sessions.find((entry) => entry.id === sessionId);
    if (!session?.projectPath) return;
    if (options.staleSessionIds.has(sessionId)) return;
    options.setSessionStatus(sessionId, 'connecting');
    const stream = new EventSource(`${options.apiBase}/agent/sessions/${encodeURIComponent(sessionId)}/stream?projectPath=${encodeURIComponent(session.projectPath)}&replay=150`);
    const names = ['session_start', 'user_turn', 'turn_start', 'turn_end', 'aborted', 'step_start', 'text_part', 'tool_call', 'step_end', 'error'];
    for (const name of names) {
      stream.addEventListener(name, (evt) => {
        options.streamErrorCountBySessionId.set(sessionId, 0);
        const session = options.sessions.find((s) => s.id === sessionId);
        if (session?.status !== 'running') options.setSessionStatus(sessionId, 'connected');
        if (!options.staleSessionIds.has(sessionId)) options.sessionNoticeById[sessionId] = undefined;
        const message = evt as MessageEvent<string>;
        try {
          const parsed = JSON.parse(message.data) as AgentEvent;
          options.reduceAgentEventToTimeline(sessionId, parsed);
        } catch {
          // ignore malformed data
        }
      });
    }
    stream.onerror = () => {
      const count = (options.streamErrorCountBySessionId.get(sessionId) ?? 0) + 1;
      options.streamErrorCountBySessionId.set(sessionId, count);
      options.setSessionStatus(sessionId, 'disconnected');
      if (count >= 3) void confirmAndMarkSessionStale(sessionId, 'Session stream disconnected. Reload sessions or start a replacement session.');
    };
    options.streamsBySessionId.set(sessionId, stream);
  }

  function syncActiveSessionStream() {
    const activeId = options.state.activeSessionId;
    for (const id of [...options.streamsBySessionId.keys()]) {
      if (!activeId || id !== activeId) disconnectSessionStream(id);
    }
    if (activeId) connectSessionStream(activeId);
  }

  function disconnectSessionStream(sessionId: string) {
    const stream = options.streamsBySessionId.get(sessionId);
    if (!stream) return;
    stream.close();
    options.streamsBySessionId.delete(sessionId);
    options.streamErrorCountBySessionId.delete(sessionId);
    if (!options.staleSessionIds.has(sessionId)) options.setSessionStatus(sessionId, 'disconnected');
  }

  function markSessionStale(sessionId: string, message: string) {
    if (options.staleSessionIds.has(sessionId)) return;
    options.staleSessionIds.add(sessionId);
    options.sessionNoticeById[sessionId] = message;
    options.setSessionStatus(sessionId, 'stale');
    disconnectSessionStream(sessionId);
  }

  async function confirmAndMarkSessionStale(sessionId: string, message: string) {
    try {
      await options.hydrateSessionDoc(sessionId);
      options.sessionNoticeById[sessionId] = 'Session stream disconnected. Reconnecting…';
      disconnectSessionStream(sessionId);
      setTimeout(() => connectSessionStream(sessionId), 750);
    } catch {
      markSessionStale(sessionId, message);
    }
  }

  return { connectSessionStream, syncActiveSessionStream, disconnectSessionStream, markSessionStale, confirmAndMarkSessionStale };
}
