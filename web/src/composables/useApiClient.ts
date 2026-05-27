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

export function useApiClient() {
  async function apiGet<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`);
    if (!response.ok) throw await readApiError(response);
    return response.json() as Promise<T>;
  }

  async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw await readApiError(response);
    return response.json() as Promise<T>;
  }

  async function apiPatch<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw await readApiError(response);
    return response.json() as Promise<T>;
  }

  async function apiDelete(path: string): Promise<void> {
    const response = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
    if (!response.ok) throw await readApiError(response);
  }

  async function apiBlob(path: string) {
    const response = await fetch(`${API_BASE}${path}`);
    if (!response.ok) throw await readApiError(response);
    return response;
  }

  return { apiGet, apiPost, apiPatch, apiDelete, apiBlob };
}
