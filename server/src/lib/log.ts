const enabled = new Set(
  [process.env.GLIB_LOG_REQUESTS === "1" ? "requests" : "", process.env.GLIB_LOG_AGENT === "1" ? "agent" : ""]
    .filter(Boolean)
);

const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m"
};

function isJsonLog() {
  return process.env.GLIB_LOG_JSON === "1";
}

function isPrettyLog() {
  return process.env.GLIB_LOG_PRETTY !== "0" && !isJsonLog();
}

function colorScope(scope: "requests" | "agent" | "server") {
  if (!isPrettyLog()) return scope;
  const color = scope === "requests" ? ANSI.cyan : scope === "agent" ? ANSI.magenta : ANSI.green;
  return `${color}${scope}${ANSI.reset}`;
}

function formatMeta(meta?: Record<string, unknown>) {
  if (!meta || Object.keys(meta).length === 0) return "";
  if (isJsonLog()) return ` ${JSON.stringify(meta)}`;
  return ` ${Object.entries(meta).map(([key, value]) => `${key}=${String(value)}`).join(" ")}`;
}

function compactRequest(message: string, meta?: Record<string, unknown>) {
  if (!meta) return null;
  const method = typeof meta.method === "string" ? meta.method : "";
  const path = typeof meta.path === "string" ? meta.path : "";
  const reqId = typeof meta.reqId === "string" ? meta.reqId : "";
  const status = typeof meta.status === "number" ? String(meta.status) : "";
  const durationMs = typeof meta.durationMs === "number" ? `${meta.durationMs}ms` : "";
  if (!method || !path || !reqId) return null;

  if (message === "start") return `[req:${reqId}] ${method} ${path}`;
  if (message === "end") return `[req:${reqId}] ${method} ${path} -> ${status || "?"} ${durationMs}`;
  if (message === "error") return `[req:${reqId}] ${method} ${path} -> error ${durationMs}`;
  return null;
}

function formatError(error: unknown, meta?: Record<string, unknown>) {
  const err = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { error };
  const data = { ...meta, ...err };
  if (isJsonLog()) return ` ${JSON.stringify(data)}`;
  const message = error instanceof Error ? error.message : String(error);
  const details = formatMeta(meta);
  return `${details}: ${message}`;
}

export function log(scope: "requests" | "agent" | "server", message: string, meta?: Record<string, unknown>) {
  if (scope !== "server" && !enabled.has(scope)) return;
  if (scope === "requests" && !isJsonLog()) {
    const compact = compactRequest(message, meta);
    if (compact) {
      const ts = isPrettyLog() ? `${ANSI.dim}${new Date().toISOString()}${ANSI.reset}` : new Date().toISOString();
      console.log(`[${ts}] [${colorScope(scope)}] ${compact}`);
      return;
    }
  }
  const suffix = formatMeta(meta);
  const ts = isPrettyLog() ? `${ANSI.dim}${new Date().toISOString()}${ANSI.reset}` : new Date().toISOString();
  console.log(`[${ts}] [${colorScope(scope)}] ${message}${suffix}`);
}

export function logError(scope: "requests" | "agent" | "server", message: string, error: unknown, meta?: Record<string, unknown>) {
  if (scope !== "server" && !enabled.has(scope)) return;
  if (scope === "requests" && !isJsonLog()) {
    const compact = compactRequest(message, meta);
    if (compact) {
      const ts = isPrettyLog() ? `${ANSI.dim}${new Date().toISOString()}${ANSI.reset}` : new Date().toISOString();
      console.error(`[${ts}] [${colorScope(scope)}] ${ANSI.red}${compact}${ANSI.reset}${formatError(error, meta)}`);
      return;
    }
  }
  const ts = isPrettyLog() ? `${ANSI.dim}${new Date().toISOString()}${ANSI.reset}` : new Date().toISOString();
  console.error(`[${ts}] [${colorScope(scope)}] ${message}${formatError(error, meta)}`);
}
