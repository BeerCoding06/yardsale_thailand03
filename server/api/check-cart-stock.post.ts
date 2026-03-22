// server/api/check-cart-stock.post.ts
// ตรวจสต็อกของรายการในตะกร้าก่อนกดชำระเงิน

import * as wpUtils from '../utils/wp';
import { isCartLineSalableBySnapshot } from '../utils/cart-line-salable';
import { fetchLiveStockLinesForCart, type CartStockItem } from '../utils/cart-live-stock';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event) as { items?: CartStockItem[] };
    const items = body?.items;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return { valid: true, errors: [] };
    }

    const consumerKey = wpUtils.getWpConsumerKey();
    const consumerSecret = wpUtils.getWpConsumerSecret();
    if (!consumerKey || !consumerSecret) {
      return { valid: true, errors: [] };
    }

    const config = useRuntimeConfig();
    const formula =
      (config as { stockSubtractPaidOrders?: boolean }).stockSubtractPaidOrders === true
        ? 'subtract_paid'
        : 'wc_only';

    const { lines, errors: fetchErrors } = await fetchLiveStockLinesForCart(items, formula);

    const errors = [...fetchErrors];

    for (const line of lines) {
      const { product_id, variation_id, quantity, name, stockQuantity, stockStatus } = line;
      const qty = Math.max(1, Number(quantity) || 1);
      const stNorm = (stockStatus || '').toLowerCase().replace(/\s/g, '');
      if (!isCartLineSalableBySnapshot(stockStatus, stockQuantity, qty)) {
        if (stockQuantity != null && qty > stockQuantity) {
          errors.push({
            product_id,
            ...(variation_id && { variation_id }),
            name,
            message: `สต็อกไม่เพียงพอ (มี ${stockQuantity} ชิ้น, สั่ง ${qty})`,
          });
        } else if (stNorm === 'outofstock') {
          errors.push({
            product_id,
            ...(variation_id && { variation_id }),
            name,
            message: 'สินค้าหมดสต็อก',
          });
        } else {
          errors.push({
            product_id,
            ...(variation_id && { variation_id }),
            name,
            message: 'สต็อกไม่เพียงพอ (0 ชิ้น)',
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (e: any) {
    console.error('[check-cart-stock] Error:', e?.message || e);
    return { valid: false, errors: [{ product_id: 0, message: e?.message || 'ตรวจสต็อกไม่สำเร็จ' }] };
  }
});
