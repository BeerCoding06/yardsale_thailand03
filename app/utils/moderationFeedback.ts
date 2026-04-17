/**
 * Parse `products.moderation_feedback` JSONB from API (seller / admin).
 */
export function parseModerationFeedback(raw: unknown) {
  let v = raw;
  if (v == null) return null;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const issues = Array.isArray(o.issues)
    ? o.issues.filter((x): x is string => typeof x === "string")
    : [];
  const message = typeof o.message === "string" ? o.message.trim() : "";
  if (!issues.length && !message) return null;
  const at = typeof o.at === "string" ? o.at : null;
  return {
    issues,
    message,
    at,
  };
}
