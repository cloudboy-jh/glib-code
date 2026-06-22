import { describe, expect, it } from 'vitest';
import { reactive } from 'vue';
import { canonicalizeProjectPath, usePickerSessions } from './usePickerSessions';

describe('canonicalizeProjectPath', () => {
  it('canonicalizes windows-like paths consistently', () => {
    expect(canonicalizeProjectPath('C:\\Repo\\App\\')).toBe('c:/repo/app');
    expect(canonicalizeProjectPath('c:/repo/app')).toBe('c:/repo/app');
  });

  it('normalizes drive casing', () => {
    expect(canonicalizeProjectPath('D:\\Projects\\Foo')).toBe('d:/projects/foo');
    expect(canonicalizeProjectPath('d:/projects/foo')).toBe('d:/projects/foo');
  });

  it('normalizes backslashes to forward slashes', () => {
    expect(canonicalizeProjectPath('C:\\Users\\johns\\Dev')).toBe('c:/users/johns/dev');
    expect(canonicalizeProjectPath('C:/Users/johns/Dev')).toBe('c:/users/johns/dev');
  });

  it('strips trailing slashes', () => {
    expect(canonicalizeProjectPath('C:/repo/app/')).toBe('c:/repo/app');
    expect(canonicalizeProjectPath('C:/repo/app//')).toBe('c:/repo/app');
    expect(canonicalizeProjectPath('C:\\repo\\app\\')).toBe('c:/repo/app');
  });

  it('handles mixed slash styles', () => {
    expect(canonicalizeProjectPath('C:\\Users/johns\\Desktop\\Proj')).toBe('c:/users/johns/desktop/proj');
  });

  it('lowercases everything', () => {
    expect(canonicalizeProjectPath('C:/REPO/MyApp')).toBe('c:/repo/myapp');
  });

  it('handles non-drive paths', () => {
    expect(canonicalizeProjectPath('/home/johns/repo')).toBe('/home/johns/repo');
    expect(canonicalizeProjectPath('/home/johns/repo/')).toBe('/home/johns/repo');
  });

  it('trims whitespace', () => {
    expect(canonicalizeProjectPath('  C:/repo/app  ')).toBe('c:/repo/app');
  });
});

describe('usePickerSessions', () => {

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
