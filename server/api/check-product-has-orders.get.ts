// server/api/check-product-has-orders.get.ts
// ตรวจว่าสินค้ายังมีออเดอร์ที่ active อยู่หรือไม่ — หลังลบออเดอร์ใน WC ต้องเป็น false ทันที (ไม่ใช้ Nitro cache)

import {
  buildWcApiUrl,
  getWpBaseUrl,
  getWpConsumerKey,
  getWpConsumerSecret,
} from '../utils/wp';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const productId = query.product_id;

    if (!productId) {
      console.warn('[check-product-has-orders] product_id is required');
      return { has_orders: false };
    }

    const idStr = String(productId);

    // 1) ปลั๊กอิน WordPress: wc_get_orders — สอดคล้อง DB จริง ออเดอร์ที่ลบแล้วไม่นับ
    try {
      const wpBase = getWpBaseUrl();
      const pluginUrl = `${wpBase}/wp-json/yardsale/v1/product-has-orders?product_id=${encodeURIComponent(idStr)}`;
      const res = await fetch(pluginUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = (await res.json()) as { has_orders?: boolean };
        if (typeof data?.has_orders === 'boolean') {
          return { has_orders: data.has_orders };
        }
      }
    } catch (e: unknown) {
      console.warn('[check-product-has-orders] Plugin yardsale/v1/product-has-orders failed:', e);
    }

    // 2) Fallback: WooCommerce REST (ถ้าปลั๊กอินยังไม่อัปเดต)
    try {
      const consumerKey = getWpConsumerKey();
      const consumerSecret = getWpConsumerSecret();

      if (!consumerKey || !consumerSecret) {
        return { has_orders: false };
      }

      const apiUrl = buildWcApiUrl('wc/v3/orders', {
        product: productId,
        per_page: 1,
        status: 'completed,processing,on-hold',
      });

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return { has_orders: false };
      }

      const orders = await response.json();
      const hasOrders = Array.isArray(orders) && orders.length > 0;
      return { has_orders: hasOrders };
    } catch (fetchError: unknown) {
      console.warn('[check-product-has-orders] WC REST fallback error:', fetchError);
      return { has_orders: false };
    }
  } catch (error: unknown) {
    console.error('[check-product-has-orders] Error:', error);
    return { has_orders: false };
  }
});
