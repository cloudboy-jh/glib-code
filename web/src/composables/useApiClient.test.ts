import { afterEach, describe, expect, it, vi } from 'vitest';
import { useApiClient } from './useApiClient';

const API_BASE = 'http://127.0.0.1:4273/api';

function stubFetch() {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

function lastBody(calls: Array<{ init?: RequestInit }>) {
  const body = calls[calls.length - 1]?.init?.body;
  return typeof body === 'string' ? JSON.parse(body) : undefined;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useApiClient project scoping', () => {
  it('injects projectPath into scoped GET query', async () => {
    const calls = stubFetch();
    const { apiGet } = useApiClient(() => 'c:/repo/app');
    await apiGet('/git/status');
    expect(calls[0].url).toBe(`${API_BASE}/git/status?projectPath=${encodeURIComponent('c:/repo/app')}`);
  });

  it('injects projectPath into scoped POST body', async () => {
    const calls = stubFetch();
    const { apiPost } = useApiClient(() => 'c:/repo/app');
    await apiPost('/git/stage', { files: ['a.ts'] });
    expect(lastBody(calls)).toEqual({ files: ['a.ts'], projectPath: 'c:/repo/app' });
  });

  it('does not inject for non-project routes', async () => {
    const calls = stubFetch();
    const { apiGet, apiPatch } = useApiClient(() => 'c:/repo/app');
    await apiGet('/projects/recents');
    await apiPatch('/settings', { themePreset: 'x' });
    expect(calls[0].url).toBe(`${API_BASE}/projects/recents`);
    expect(lastBody(calls)).toEqual({ themePreset: 'x' });
  });

  it('does not override an explicitly scoped query', async () => {
    const calls = stubFetch();
    const { apiGet } = useApiClient(() => 'c:/repo/app');
    await apiGet('/sessions/s1/diff?projectPath=c:/other');
    expect(calls[0].url).toBe(`${API_BASE}/sessions/s1/diff?projectPath=c:/other`);
  });

  it('does not override an explicitly scoped body', async () => {
    const calls = stubFetch();
    const { apiPost } = useApiClient(() => 'c:/repo/app');
    await apiPost('/agent/sessions', { title: 't', projectPath: 'c:/other' });
    expect(lastBody(calls)).toEqual({ title: 't', projectPath: 'c:/other' });
  });

  it('sends unscoped requests when no project is open', async () => {
    const calls = stubFetch();
    const { apiGet } = useApiClient(() => null);
    await apiGet('/git/status');
    expect(calls[0].url).toBe(`${API_BASE}/git/status`);
  });

  it('preserves existing query params when injecting', async () => {
    const calls = stubFetch();
    const { apiGet } = useApiClient(() => 'c:/repo/app');
    await apiGet('/diff/files?source=uncommitted');
    expect(calls[0].url).toBe(`${API_BASE}/diff/files?source=uncommitted&projectPath=${encodeURIComponent('c:/repo/app')}`);
  });
});
