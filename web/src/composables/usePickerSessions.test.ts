import { describe, expect, it } from 'vitest';
import { reactive } from 'vue';
import { canonicalizeProjectPath, usePickerSessions } from './usePickerSessions';

describe('usePickerSessions', () => {
  it('canonicalizes windows-like paths consistently', () => {
    expect(canonicalizeProjectPath('C:\\Repo\\App\\')).toBe('c:/repo/app');
    expect(canonicalizeProjectPath('c:/repo/app')).toBe('c:/repo/app');
  });

  it('groups and sorts sessions by canonical project path', async () => {
    const pickerSessionCatalog = reactive<Array<{ id: string; title: string; time: string; updatedAt?: string; status: 'connected' | 'connecting' | 'disconnected' | 'stale' | 'running'; projectPath: string }>>([]);
    const rows = [
      { id: 'a', title: 'A', time: '1m', updatedAt: '2026-01-01T00:00:00.000Z', status: 'connected', projectPath: 'C:/Repo/App' },
      { id: 'b', title: 'B', time: 'now', updatedAt: '2026-01-02T00:00:00.000Z', status: 'connected', projectPath: 'c:\\repo\\app\\' }
    ];
    const { hydratePickerSessions, pickerSessionsByPath } = usePickerSessions({
      apiGet: async <T>() => rows as T,
      mapApiSession: (meta) => meta as any,
      pickerSessionCatalog
    });

    await hydratePickerSessions();
    const grouped = pickerSessionsByPath.value['c:/repo/app'];
    expect(grouped).toHaveLength(2);
    expect(grouped[0].id).toBe('b');
    expect(grouped[1].id).toBe('a');
  });
});
