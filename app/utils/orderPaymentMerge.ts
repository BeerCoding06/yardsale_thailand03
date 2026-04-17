import { normalizeOrderStatusKey } from "~/utils/orderStatus";

function statusLooksPaid(s: string): boolean {
  return (
    s === "paid" ||
    s === "processing" ||
    s === "completed" ||
    s === "refunded" ||
    s === "partially_refunded"
  );
}

function truthyPaid(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (t === "true" || t === "1" || t === "yes") return true;
  }
  return false;
}

/**
 * รวมแถวออเดอร์จาก API — กัน get-order/replica ตอบ pending ทับ state ที่เพิ่งชำระแล้ว
 * (เช่น merge { ...prev, ...o } ทำให้ slip + paid หาย)
 */
export function mergeOrderRowsPreferPaid<T extends Record<string, unknown>>(
  prev: T | null | undefined,
  incoming: T | null | undefined
): T {
  if (!incoming || typeof incoming !== "object") {
    return (prev ?? {}) as T;
  }
  const p = prev && typeof prev === "object" ? { ...prev } : {};
  const merged = { ...p, ...incoming } as T;
  const inc = normalizeOrderStatusKey(merged.status ?? merged.order_status);
  const prevPaid =
    statusLooksPaid(normalizeOrderStatusKey(p.status ?? p.order_status)) ||
    truthyPaid(p.is_paid) ||
    truthyPaid(p.set_paid) ||
    truthyPaid(p.paid) ||
    String(p.slip_image_url ?? "").trim().length > 0;
  if (inc === "pending" && prevPaid) {
    merged.status = (p.status ?? p.order_status ?? merged.status) as T["status"];
    if (p.order_status != null) merged.order_status = p.order_status as T["order_status"];
    merged.slip_image_url = (p.slip_image_url ?? merged.slip_image_url) as T["slip_image_url"];
    if (p.is_paid != null) merged.is_paid = p.is_paid as T["is_paid"];
  }
  return merged;
}
