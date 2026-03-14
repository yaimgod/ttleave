/**
 * Validates that a redirect path is safe (same-origin path only).
 * Prevents open redirects via protocol-relative (//evil.com) or other tricks.
 */
const SAFE_REDIRECT_DEFAULT = "/dashboard";

export function getSafeRedirectPath(
  path: string | null | undefined,
  defaultPath: string = SAFE_REDIRECT_DEFAULT
): string {
  if (path == null || typeof path !== "string") return defaultPath;
  const trimmed = path.trim();
  if (trimmed === "") return defaultPath;
  // Must start with single "/", not "//" (protocol-relative URL)
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return defaultPath;
  // No backslash (path traversal or escaping)
  if (trimmed.includes("\\")) return defaultPath;
  return trimmed;
}
