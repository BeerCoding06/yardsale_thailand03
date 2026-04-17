/**
 * เก็บออเดอร์ล่าสุดที่ชำระแล้ว — ใช้ merge ตอน fetch รายการ (ไม่ใช้ watch ฟังทุกครั้ง)
 */
export type OrderPaidBroadcast = {
  orderId: string;
  order: Record<string, unknown>;
  at: number;
};

export function useOrderPaymentSync() {
  const lastPaid = useState<OrderPaidBroadcast | null>(
    "yardsale_order_paid_last",
    () => null
  );

  function notifyOrderPaidAfterMock(order: Record<string, unknown>) {
    const id = order?.id != null ? String(order.id).trim() : "";
    if (!id) return;
    const prev = lastPaid.value;
    const now = Date.now();
    if (prev?.orderId === id && now - prev.at < 2500) return;
    lastPaid.value = { orderId: id, order: { ...order }, at: now };
  }

  return { lastPaid, notifyOrderPaidAfterMock };
}
