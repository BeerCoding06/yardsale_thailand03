// server/api/refresh-cart-stock.post.ts
// คืนสต็อกล่าสุดต่อรายการตะกร้า — ใช้ตอนเปิดหน้า Checkout

import { fetchLiveStockLinesForCart, type CartStockItem } from '../utils/cart-live-stock';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event) as { items?: CartStockItem[] };
    const items = body?.items;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return { ok: true, lines: [], errors: [] };
    }

    const config = useRuntimeConfig();
    const formula =
      (config as { stockSubtractPaidOrders?: boolean }).stockSubtractPaidOrders === true
        ? 'subtract_paid'
        : 'wc_only';

    const { lines, errors } = await fetchLiveStockLinesForCart(items, formula);

    return { ok: true, lines, errors };
  } catch (e: any) {
    console.error('[refresh-cart-stock]', e?.message || e);
    return {
      ok: false,
      lines: [],
      errors: [{ product_id: 0, message: e?.message || 'รีเฟรชสต็อกไม่สำเร็จ' }],
    };
  }
});
