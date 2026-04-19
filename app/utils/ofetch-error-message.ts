/**
 * HTTP status จาก ofetch / $fetch — ตำแหน่งฟิลด์เปลี่ยนตามเวอร์ชัน Nitro/ofetch
 */
export function getOfetchHttpStatus(err: unknown): number | undefined {
  if (err == null || typeof err !== 'object') return undefined;
  const e = err as Record<string, unknown>;
  const tryNum = (v: unknown): number | undefined => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 100 && n <= 599 ? n : undefined;
  };

  const fromResponse = e.response as Record<string, unknown> | undefined;
  const fromData = e.data as Record<string, unknown> | undefined;
  const fromUnderscoreData = e._data as Record<string, unknown> | undefined;
  const nested =
    fromResponse?._data != null && typeof fromResponse._data === 'object'
      ? (fromResponse._data as Record<string, unknown>)
      : undefined;

  const fromFields =
    tryNum(e.statusCode) ??
    tryNum(e.status) ??
    tryNum(fromResponse?.status) ??
    tryNum(fromData?.statusCode) ??
    tryNum(fromData?.status) ??
    tryNum(fromUnderscoreData?.statusCode) ??
    tryNum(nested?.statusCode);
  if (fromFields != null) return fromFields;

  /** เช่น `FetchError: [POST] "/path": 500` */
  if (typeof e.message === 'string') {
    const m = e.message.match(/:\s*(\d{3})\b/);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= 400 && n <= 599) return n;
    }
  }
  return undefined;
}

/**
 * ดึงข้อความจาก ofetch/FetchError หลัง API ส่ง 4xx/5xx (Nuxt $fetch)
 * ไม่ให้ผู้ใช้เห็นแค่ `FetchError [POST] "...": 400`
 */
export function getOfetchErrorMessage(err: unknown): string {
  if (err == null) return 'Unknown error';
  if (typeof err === 'string') return err;
  const e = err as Record<string, unknown>;

  const fromObject = (o: unknown): string | undefined => {
    if (o == null || typeof o !== 'object') return undefined;
    const r = o as Record<string, unknown>;
    if (typeof r.message === 'string' && r.message.trim()) return r.message;
    if (typeof r.statusMessage === 'string' && r.statusMessage.trim()) return r.statusMessage;
    return undefined;
  };

  const response = e.response as { _data?: unknown; statusText?: string } | undefined;
  const msg =
    fromObject(e.data) ||
    fromObject(e._data) ||
    fromObject(response?._data) ||
    (typeof e.statusMessage === 'string' && e.statusMessage.trim() ? e.statusMessage : undefined) ||
    (typeof response?.statusText === 'string' && response.statusText.trim()
      ? response.statusText
      : undefined);

  if (msg) return msg;
  if (err instanceof Error && err.message) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
