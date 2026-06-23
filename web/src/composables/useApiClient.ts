const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:4273/api';

export class ApiRequestError extends Error {
  status: number;
  code?: string;
  payload?: unknown;

  constructor(status: number, message: string, code?: string, payload?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

async function readApiError(response: Response) {
  const detail = await response.text().catch(() => '');
  if (!detail) return new ApiRequestError(response.status, `request failed: ${response.status}`);
  try {
    const parsed = JSON.parse(detail) as { message?: string; error?: string; code?: string };
    return new ApiRequestError(response.status, parsed.message || parsed.error || parsed.code || detail, parsed.code, parsed);
  } catch {
    return new ApiRequestError(response.status, detail);
  }
}

// Routes that resolve their own project (or operate globally) and must never
// have the current project's path injected. Matched against the path prefix.
const NO_INJECT_PREFIXES = [
  '/projects',
  '/settings',
  '/providers',
  '/auth',
  '/readiness',
  '/attachments'
];

function shouldInject(path: string) {
  const clean = path.split('?')[0];
  return !NO_INJECT_PREFIXES.some((prefix) => clean === prefix || clean.startsWith(`${prefix}/`));
}

function injectQuery(path: string, projectPath: string) {
  if (!shouldInject(path)) return path;
  if (/[?&]projectPath=/.test(path)) return path; // caller already scoped it
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}projectPath=${encodeURIComponent(projectPath)}`;
}

function injectBody(path: string, body: Record<string, unknown>, projectPath: string) {
  if (!shouldInject(path)) return body;
  if (/[?&]projectPath=/.test(path)) return body;
  if ('projectPath' in body) return body; // caller already scoped it
  return { ...body, projectPath };
}

// `getProjectPath` returns the current project's path, or null when no project
// is open. When null, requests go out unscoped (backend stays lenient for now).
export function useApiClient(getProjectPath?: () => string | null | undefined) {
  function resolvePath(path: string) {
    const projectPath = getProjectPath?.();
    return projectPath ? injectQuery(path, projectPath) : path;
  }

  function resolveBody(path: string, body: Record<string, unknown>) {
    const projectPath = getProjectPath?.();
    return projectPath ? injectBody(path, body, projectPath) : body;
  }

  async function apiGet<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE}${resolvePath(path)}`);
    if (!response.ok) throw await readApiError(response);
    return response.json() as Promise<T>;
  }

  async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${API_BASE}${resolvePath(path)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(resolveBody(path, body))
    });
    if (!response.ok) throw await readApiError(response);
    return response.json() as Promise<T>;
  }

  async function apiPatch<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${API_BASE}${resolvePath(path)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(resolveBody(path, body))
    });
    if (!response.ok) throw await readApiError(response);
    return response.json() as Promise<T>;
  }

  async function apiDelete(path: string): Promise<void> {
    const response = await fetch(`${API_BASE}${resolvePath(path)}`, { method: 'DELETE' });
    if (!response.ok) throw await readApiError(response);
  }

  async function apiBlob(path: string) {
    const response = await fetch(`${API_BASE}${resolvePath(path)}`);
    if (!response.ok) throw await readApiError(response);
    return response;
  }

  return { apiGet, apiPost, apiPatch, apiDelete, apiBlob };
}
