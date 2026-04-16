/**
 * แจ้งทุกหน้าที่ subscribe ว่าออเดอร์ชำระเงินแล้ว (POST payment/mock หรือแอดมิน mark-paid)
 * — ใช้ useState เพื่อซิงค์ระหว่าง route โดยไม่ต้องพึ่งแท็บโฟกัส
 */
export type OrderPaidBroadcast = {
  orderId: string;
  order: Record<string, unknown>;
  at: number;
};

export function useOrderPaymentSync() {
  const tick = useState<number>("yardsale_order_paid_tick", () => 0);
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
    tick.value += 1;
  }

  return { tick, lastPaid, notifyOrderPaidAfterMock };
}
