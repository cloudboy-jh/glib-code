type Mode = 'diff' | 'session';

type RecentStatus = 'ok' | 'missing_path' | 'missing_git';

type RecentEntry = { id: string; name: string; path: string; lastOpenedAt: string; status: RecentStatus };

export function useSessionOrchestrator(options: {
  apiPost: <T>(path: string, body: Record<string, unknown>) => Promise<T>;
  apiDelete: (path: string) => Promise<void>;
  hydrateRecents: () => Promise<void>;
  hydrateSessions: () => Promise<void>;
  queueProjectOpen: (projectName: string, path: string, mode: Mode, opts?: { skipAutoCreate?: boolean }) => Promise<void>;
  createSession: () => Promise<unknown>;
  selectSessionFromSidebar: (sessionId: string) => void;
  sessions: Array<{ id: string }>;
  recents: RecentEntry[];
}) {
  async function resolveProjectOpen(path: string) {
    const normalizedPath = path.trim();
    if (!normalizedPath) return { ok: false as const, reason: 'missing_path' as const };

    try {
      const opened = await options.apiPost<{ id?: string; name?: string; path?: string; branch?: string; needsInit?: boolean }>('/projects/open', {
        path: normalizedPath
      });
      if (opened.needsInit) return { ok: false as const, reason: 'missing_git' as const };
      return {
        ok: true as const,
        name: opened.name ?? normalizedPath.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? 'project',
        path: opened.path ?? normalizedPath
      };
    } catch {
      if (import.meta.env.DEV) {
        return {
          ok: true as const,
          name: normalizedPath.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? 'project',
          path: normalizedPath
        };
      }
      return { ok: false as const, reason: 'missing_path' as const };
    }
  }

  async function openRecentProject(payload: { name: string; path: string; mode: Mode }) {
    const opened = await resolveProjectOpen(payload.path);
    if (!opened.ok) {
      void options.hydrateRecents();
      return;
    }
    const recent = options.recents.find((r) => r.path === payload.path);
    if (recent) recent.status = 'ok';
    await options.queueProjectOpen(payload.name || recent?.name || opened.name, opened.path, payload.mode);
    void options.hydrateRecents();
  }

  async function continueRecentSessionFromPicker(payload: { name: string; path: string; sessionId: string }) {
    const opened = await resolveProjectOpen(payload.path);
    if (!opened.ok) {
      void options.hydrateRecents();
      return;
    }
    const recent = options.recents.find((r) => r.path === payload.path);
    if (recent) recent.status = 'ok';
    await options.queueProjectOpen(payload.name || recent?.name || opened.name, opened.path, 'session');
    await options.hydrateSessions().catch(() => undefined);
    const target = options.sessions.find((session) => session.id === payload.sessionId);
    if (target) options.selectSessionFromSidebar(target.id);
    void options.hydrateRecents();
  }

  async function startNewRecentSessionFromPicker(payload: { name: string; path: string }) {
    const opened = await resolveProjectOpen(payload.path);
    if (!opened.ok) {
      void options.hydrateRecents();
      return;
    }
    const recent = options.recents.find((r) => r.path === payload.path);
    if (recent) recent.status = 'ok';
    await options.queueProjectOpen(payload.name || recent?.name || opened.name, opened.path, 'session', { skipAutoCreate: true });
    await options.createSession();
    void options.hydrateRecents();
  }

  async function removeRecentProject(id: string) {
    try {
      await options.apiDelete(`/projects/recents/${id}`);
      await options.hydrateRecents();
    } catch {
      const index = options.recents.findIndex((row) => row.id === id);
      if (index >= 0) options.recents.splice(index, 1);
    }
  }

  async function forgetRecentProject(id: string) {
    try {
      await options.apiPost(`/projects/recents/${id}/forget`, {});
      await options.hydrateRecents();
    } catch {
      const index = options.recents.findIndex((row) => row.id === id);
      if (index >= 0) options.recents.splice(index, 1);
    }
  }

  return {
    resolveProjectOpen,
    openRecentProject,
    continueRecentSessionFromPicker,
    startNewRecentSessionFromPicker,
    removeRecentProject,
    forgetRecentProject
  };
}
