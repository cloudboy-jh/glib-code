export function canonicalProjectPath(value?: string | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const slash = trimmed.replace(/\\/g, "/");
  const withoutTrailing = slash.replace(/\/+$/g, "");
  if (!withoutTrailing) return null;
  // Reject Windows drive-letter paths (e.g. "C:/repos/foo") on non-Windows.
  // path.resolve() treats them as relative on POSIX, producing garbage like
  // "/server/cwd/C:/repos/foo" which then gets stored and breaks all git ops.
  if (process.platform !== "win32" && /^[a-zA-Z]:\//.test(withoutTrailing)) return null;
  return process.platform === "win32" ? withoutTrailing.toLowerCase() : withoutTrailing;
}
