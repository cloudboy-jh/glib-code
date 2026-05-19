const enabled = new Set(
  [process.env.GLIB_LOG_REQUESTS === "1" ? "requests" : "", process.env.GLIB_LOG_AGENT === "1" ? "agent" : ""]
    .filter(Boolean)
);

function isJsonLog() {
  return process.env.GLIB_LOG_JSON === "1";
}

function formatMeta(meta?: Record<string, unknown>) {
  if (!meta || Object.keys(meta).length === 0) return "";
  if (isJsonLog()) return ` ${JSON.stringify(meta)}`;
  return ` ${Object.entries(meta).map(([key, value]) => `${key}=${String(value)}`).join(" ")}`;
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
  const suffix = formatMeta(meta);
  console.log(`[${new Date().toISOString()}] [${scope}] ${message}${suffix}`);
}

export function logError(scope: "requests" | "agent" | "server", message: string, error: unknown, meta?: Record<string, unknown>) {
  if (scope !== "server" && !enabled.has(scope)) return;
  console.error(`[${new Date().toISOString()}] [${scope}] ${message}${formatError(error, meta)}`);
}
