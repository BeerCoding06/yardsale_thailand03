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
