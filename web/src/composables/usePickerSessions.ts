import { computed, type Ref } from 'vue';

type SessionStatus = 'connected' | 'connecting' | 'disconnected' | 'stale' | 'running' | 'done';

type SessionLike = {
  id: string;
  title: string;
  time: string;
  updatedAt?: string;
  status: SessionStatus;
  projectPath: string;
};

export function canonicalizeProjectPath(path: string) {
  const slashNormalized = path.replace(/\\/g, '/').trim();
  const withoutTrailing = slashNormalized.replace(/\/+$/g, '');
  const maybeDrive = /^[A-Za-z]:\//.test(withoutTrailing);
  const normalizedDrive = maybeDrive ? `${withoutTrailing[0].toLowerCase()}${withoutTrailing.slice(1)}` : withoutTrailing;
  return normalizedDrive.toLowerCase();
}

export function usePickerSessions(options: {
  apiGet: <T>(path: string) => Promise<T>;
  mapApiSession: (meta: unknown) => SessionLike;
  pickerSessionCatalog: SessionLike[];
}) {
  const pickerSessionsByPath = computed(() => {
    const grouped: Record<string, Array<{ id: string; title: string; time: string; updatedAt?: string; status: SessionStatus }>> = {};
    for (const session of options.pickerSessionCatalog) {
      const key = canonicalizeProjectPath(session.projectPath);
      if (!key) continue;
      const list = grouped[key] ?? (grouped[key] = []);
      list.push({
        id: session.id,
        title: session.title,
        time: session.time,
        updatedAt: session.updatedAt,
        status: session.status
      });
    }
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => toEpochMs(b.updatedAt) - toEpochMs(a.updatedAt));
    }
    return grouped;
  });

  async function hydratePickerSessions() {
    try {
      const rows = await options.apiGet<unknown[]>('/sessions?scope=all');
      options.pickerSessionCatalog.splice(0, options.pickerSessionCatalog.length, ...rows.map(options.mapApiSession));
    } catch {
      options.pickerSessionCatalog.splice(0, options.pickerSessionCatalog.length);
    }
  }

  return { pickerSessionsByPath, hydratePickerSessions };
}

function toEpochMs(value?: string) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
