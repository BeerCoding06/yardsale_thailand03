// server/api/check-cart-stock.post.ts
// ตรวจสต็อกของรายการในตะกร้าก่อนกดชำระเงิน: ทุกรายการต้องมี stock > 0 และ quantity <= stock

import * as wpUtils from '../utils/wp';
import { isCartLineSalableBySnapshot } from '../utils/cart-line-salable';
import { fetchYardsaleStockBatch } from '../utils/yardsale-stock';

type Item = { product_id: number; variation_id?: number; quantity: number };

type PendingLine = {
  item: Item;
  qty: number;
  stockQuantity: number | null;
  stockStatus: string;
  name: string;
  lineId: number;
};

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event) as { items?: Item[] };
    const items = body?.items;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return { valid: true, errors: [] };
    }

    const errors: { product_id: number; variation_id?: number; message: string; name?: string }[] = [];
    const consumerKey = wpUtils.getWpConsumerKey();
    const consumerSecret = wpUtils.getWpConsumerSecret();

    if (!consumerKey || !consumerSecret) {
      return { valid: true, errors: [] };
    }

    const config = useRuntimeConfig();
    /** Opt-in — ถ้าเปิดโดยไม่จำเป็นเมื่อ WC ลดสต็อกแล้ว จะทำให้สต็อกต่ำเกินจริงและบล็อก checkout */
    const useSubtractPaid =
      (config as { stockSubtractPaidOrders?: boolean }).stockSubtractPaidOrders === true;

    const pending: PendingLine[] = [];

    for (const item of items) {
      const { product_id, variation_id, quantity } = item;
      const qty = Math.max(0, Number(quantity) || 0);
      if (qty < 1) continue;

      try {
        let stockQuantity: number | null = null;
        let stockStatus: string = 'instock';
        let name = '';

        if (variation_id) {
          const varUrl = wpUtils.buildWcApiUrl(`wc/v3/products/${product_id}/variations/${variation_id}`);
          const varRes = await fetch(varUrl, { headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5000) });
          if (!varRes.ok) {
            errors.push({ product_id, variation_id, message: 'ไม่พบรายการหรือสต็อก' });
            continue;
          }
          const vari = await varRes.json();
          name = vari.name || vari.sku || `#${variation_id}`;
          stockStatus = (vari.stock_status || 'instock').toString().toLowerCase();
          stockQuantity = vari.stock_quantity != null ? Number(vari.stock_quantity) : null;
        } else {
          const prodUrl = wpUtils.buildWcApiUrl(`wc/v3/products/${product_id}`);
          const prodRes = await fetch(prodUrl, { headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5000) });
          if (!prodRes.ok) {
            errors.push({ product_id, message: 'ไม่พบรายการหรือสต็อก' });
            continue;
          }
          const prod = await prodRes.json();
          name = prod.name || prod.sku || `#${product_id}`;
          const pType = String(prod.type || '').toLowerCase();
          if (pType === 'variable' && !variation_id) {
            errors.push({
              product_id,
              name,
              message:
                'สินค้านี้มีตัวเลือก — ลบรายการในตะกร้าแล้วเปิดหน้าสินค้าเลือกตัวเลือกแล้วเพิ่มใหม่',
            });
            continue;
          }
          stockStatus = (prod.stock_status || 'instock').toString().toLowerCase();
          stockQuantity = prod.stock_quantity != null ? Number(prod.stock_quantity) : null;
        }

        const lineId = variation_id ? Number(variation_id) : Number(product_id);
        pending.push({ item, qty, stockQuantity, stockStatus, name, lineId });
      } catch (e: any) {
        errors.push({
          product_id: item.product_id,
          ...(item.variation_id && { variation_id: item.variation_id }),
          message: e?.message || 'ตรวจสต็อกไม่ได้',
        });
      }
    }

    const lineIds = pending.map((p) => p.lineId);
    const stockMap = useSubtractPaid
      ? await fetchYardsaleStockBatch(lineIds, 'subtract_paid')
      : new Map();

    for (const row of pending) {
      const { item, qty, name } = row;
      const { product_id, variation_id } = item;

      let stockQuantity = row.stockQuantity;
      let stockStatus = row.stockStatus;
      const adj = stockMap.get(row.lineId);
      if (adj && adj.effective_quantity != null) {
        stockQuantity = adj.effective_quantity;
        stockStatus = adj.effective_status || stockStatus;
      }

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
