/**
 * สถานะการชำระเงินฝั่งลูกค้า — แมปจาก order.status (Yardsale / Woo-style)
 */
export type CustomerPaymentUiKey =
  | "awaiting_payment"
  | "paid"
  | "payment_failed"
  | "cancelled"
  | "unknown";

function normalizeStatus(raw: string | undefined | null): string {
  return String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/-/g, "_");
}

export function customerPaymentUiKey(order: {
  status?: string | null;
}): CustomerPaymentUiKey {
  const s = normalizeStatus(order?.status);
  if (!s) return "unknown";
  if (s === "canceled" || s === "cancelled") return "cancelled";
  if (s === "payment_failed" || s === "failed") return "payment_failed";
  if (s === "paid" || s === "processing" || s === "completed") return "paid";
  if (s === "pending" || s === "on_hold" || s === "onhold") return "awaiting_payment";
  return "unknown";
}

export function useCustomerPaymentStatus() {
  const { t } = useI18n();

  function paymentLabel(order: { status?: string | null }): string {
    const key = customerPaymentUiKey(order);
    return t(`order.customer_payment.${key}`);
  }

  function paymentColorClass(order: { status?: string | null }): string {
    const key = customerPaymentUiKey(order);
    const map: Record<CustomerPaymentUiKey, string> = {
      awaiting_payment:
        "bg-amber-100 dark:bg-amber-900/35 text-amber-900 dark:text-amber-100",
      paid: "bg-emerald-100 dark:bg-emerald-900/35 text-emerald-900 dark:text-emerald-100",
      payment_failed:
        "bg-red-100 dark:bg-red-900/35 text-red-900 dark:text-red-100",
      cancelled:
        "bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200",
      unknown:
        "bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200",
    };
    return map[key];
  }

  /** ยกเลิกได้เฉพาะเมื่อยังไม่ชำระเงินแล้ว — ชำระแล้ว (รวม processing/completed) ไม่แสดงปุ่มยกเลิก */
  function canCancelByPaymentRules(order: { status?: string | null }): boolean {
    const s = normalizeStatus(order?.status);
    if (!s) return false;
    const key = customerPaymentUiKey(order);
    if (key === "cancelled" || key === "paid") return false;
    return true;
  }

  /** โอน/อัปโหลดสลิป — ยังรอชำระ (Yardsale: pending) */
  function canPayOrder(order: { status?: string | null }): boolean {
    return normalizeStatus(order?.status) === "pending";
  }

  return {
    customerPaymentUiKey,
    paymentLabel,
    paymentColorClass,
    canCancelByPaymentRules,
    canPayOrder,
  };
}
