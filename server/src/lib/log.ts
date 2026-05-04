const enabled = new Set(
  [process.env.GLIB_LOG_REQUESTS === "1" ? "requests" : "", process.env.GLIB_LOG_AGENT === "1" ? "agent" : ""]
    .filter(Boolean)
);

export function log(scope: "requests" | "agent" | "server", message: string, meta?: Record<string, unknown>) {
  if (scope !== "server" && !enabled.has(scope)) return;
  const suffix = meta ? ` ${JSON.stringify(meta)}` : "";
  console.log(`[${new Date().toISOString()}] [${scope}] ${message}${suffix}`);
}

export function logError(scope: "requests" | "agent" | "server", message: string, error: unknown, meta?: Record<string, unknown>) {
  if (scope !== "server" && !enabled.has(scope)) return;
  const err = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { error };
  console.error(`[${new Date().toISOString()}] [${scope}] ${message} ${JSON.stringify({ ...meta, ...err })}`);
}
