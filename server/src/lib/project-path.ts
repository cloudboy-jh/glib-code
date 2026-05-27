export function canonicalProjectPath(value?: string | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const slash = trimmed.replace(/\\/g, "/");
  const withoutTrailing = slash.replace(/\/+$/g, "");
  if (!withoutTrailing) return null;
  return process.platform === "win32" ? withoutTrailing.toLowerCase() : withoutTrailing;
}
