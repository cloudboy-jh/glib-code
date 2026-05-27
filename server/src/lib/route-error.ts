export type RouteErrorBody = {
  ok: false;
  code: string;
  message: string;
  retryable?: boolean;
};

export function routeError(message: string, code: string, retryable = false): RouteErrorBody {
  return { ok: false, code, message, retryable };
}
