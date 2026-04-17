/**
 * เก็บออเดอร์ล่าสุดที่ชำระแล้ว — merge ตอน fetch รายการ
 * + sessionStorage เพื่อหลัง refresh เต็มหน้า (useState ถูกล้าง) ยัง merge ได้ชั่วระยะเวลาหนึ่ง
 */
export type OrderPaidBroadcast = {
  orderId: string;
  order: Record<string, unknown>;
  at: number;
};

const STORAGE_KEY = "yardsale_order_paid_client_hint";

/** ระยะเวลา merge ฝั่ง client หลังชำระ — หมดแล้วแสดงตาม API จริง */
export const CLIENT_PAID_HINT_MERGE_MS = 2 * 60 * 60 * 1000;

function readStored(): OrderPaidBroadcast | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    const rec = o as Record<string, unknown>;
    const orderId = String(rec.orderId ?? "").trim();
    const at = Number(rec.at);
    const order = rec.order;
    if (
      !orderId ||
      !Number.isFinite(at) ||
      typeof order !== "object" ||
      order === null ||
      Array.isArray(order)
    ) {
      return null;
    }
    if (Date.now() - at > CLIENT_PAID_HINT_MERGE_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return { orderId, order: order as Record<string, unknown>, at };
  } catch {
    return null;
  }
}

function writeStored(v: OrderPaidBroadcast) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    /* private mode / quota */
  }
}

function clearStoredOnly() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* */
  }
}

export function useOrderPaymentSync() {
  const lastPaid = useState<OrderPaidBroadcast | null>(
    "yardsale_order_paid_last",
    () => (import.meta.server ? null : readStored())
  );

  function notifyOrderPaidAfterMock(order: Record<string, unknown>) {
    const id = order?.id != null ? String(order.id).trim() : "";
    if (!id) return;
    const prev = lastPaid.value;
    const now = Date.now();
    if (prev?.orderId === id && now - prev.at < 2500) return;
    const next = { orderId: id, order: { ...order }, at: now };
    lastPaid.value = next;
    writeStored(next);
  }

  /** เรียกเมื่อ GET จากเซิร์ฟเวอร์ยืนยันชำระแล้ว — ไม่ต้อง merge client อีก */
  function clearClientPaidHintIfMatches(orderId: string) {
    const want = String(orderId ?? "").trim();
    if (!want) return;
    const cur = lastPaid.value;
    if (cur && String(cur.orderId) === want) {
      lastPaid.value = null;
      clearStoredOnly();
    }
  }

  return {
    lastPaid,
    notifyOrderPaidAfterMock,
    clearClientPaidHintIfMatches,
  };
}
