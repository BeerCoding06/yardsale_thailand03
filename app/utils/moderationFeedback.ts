/**
 * Parse `products.moderation_feedback` JSONB from API (seller / admin).
 * รองรับ: JSON { issues, message, at } — ข้อความล้วน — หรือฟิลด์ reason / note / reviewed_at
 */
export function parseModerationFeedback(raw: unknown) {
  let v = raw;
  if (v == null) return null;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    try {
      v = JSON.parse(s);
    } catch {
      return { issues: [], message: s, at: null };
    }
  }
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const issues = Array.isArray(o.issues)
    ? o.issues.filter((x): x is string => typeof x === "string")
    : [];
  const messageRaw =
    typeof o.message === "string"
      ? o.message
      : typeof o.reason === "string"
        ? o.reason
        : typeof o.note === "string"
          ? o.note
          : "";
  const message = messageRaw.trim();
  if (!issues.length && !message) return null;
  const at =
    typeof o.at === "string"
      ? o.at
      : typeof o.reviewed_at === "string"
        ? o.reviewed_at
        : null;
  return {
    issues,
    message,
    at,
  };
}
