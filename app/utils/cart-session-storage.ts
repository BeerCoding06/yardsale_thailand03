/**
 * ตะกร้าใน localStorage: หมดอายุหลังไม่มีการแก้ไขเกิน CART_SESSION_MS (เลื่อนตามทุกครั้งที่บันทึก)
 */
export const CART_LOCAL_STORAGE_KEY = 'cart';
/** 48 ชั่วโมง */
export const CART_SESSION_MS = 48 * 60 * 60 * 1000;

const PERSIST_V = 1 as const;

type PersistedCartV1 = {
  v: typeof PERSIST_V;
  savedAt: number;
  items: unknown[];
};

function isValidCartItemShape(item: unknown): boolean {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const x = item as Record<string, unknown>;
  return (
    typeof x.key === 'string' &&
    typeof x.quantity === 'number' &&
    x.product != null &&
    typeof x.product === 'object' &&
    (x.product as Record<string, unknown>).node != null
  );
}

export function parseStoredCart(raw: string | null): {
  items: unknown[];
  expired: boolean;
} {
  if (raw == null || raw === '') return { items: [], expired: false };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return { items: parsed.filter(isValidCartItemShape), expired: false };
    }
    if (parsed && typeof parsed === 'object' && parsed !== null) {
      const o = parsed as Partial<PersistedCartV1>;
      const savedAt = typeof o.savedAt === 'number' ? o.savedAt : null;
      if (savedAt != null && Date.now() - savedAt > CART_SESSION_MS) {
        return { items: [], expired: true };
      }
      if (Array.isArray(o.items)) {
        return { items: o.items.filter(isValidCartItemShape), expired: false };
      }
    }
  } catch {
    return { items: [], expired: false };
  }
  return { items: [], expired: false };
}

export function stringifyStoredCart(items: unknown[]): string {
  return JSON.stringify({
    v: PERSIST_V,
    savedAt: Date.now(),
    items,
  } satisfies PersistedCartV1);
}
