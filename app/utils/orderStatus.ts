/**
 * Postgres enum / บาง driver หรือ JSON คืน status เป็น object — ห้าม String() ตรงๆ
 * (จะได้ "[object Object]" แล้ว is_paid / paid detection พัง)
 */
export function coerceOrderStatusRawToString(raw: unknown): string {
  if (raw == null || raw === "") return "";
  if (typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>;
    if (typeof o.value === "string" && o.value.trim()) return o.value.trim();
    if (typeof o.name === "string" && o.name.trim()) return o.name.trim();
  }
  return String(raw).trim();
}

/** คีย์สำหรับเทียบ paid / pending — lowercase + underscore */
export function normalizeOrderStatusKey(raw: unknown): string {
  return coerceOrderStatusRawToString(raw)
    .toLowerCase()
    .replace(/-/g, "_");
}
