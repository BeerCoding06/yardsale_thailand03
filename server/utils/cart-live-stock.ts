// server/utils/cart-live-stock.ts
// ดึง stock ล่าสุดจาก WC REST + ปลั๊กอิน Yardsale (ใช้ร่วม check-cart-stock / refresh-cart-stock)

import * as wpUtils from './wp';
import { fetchYardsaleStockBatch, type StockFormula } from './yardsale-stock';

export type CartStockItem = { product_id: number; variation_id?: number; quantity: number };

export type LiveStockLine = {
  product_id: number;
  variation_id?: number;
  quantity: number;
  name: string;
  stockQuantity: number | null;
  stockStatus: string;
};

export type CartStockFetchError = {
  product_id: number;
  variation_id?: number;
  message: string;
  name?: string;
};

type PendingRow = {
  item: CartStockItem;
  qty: number;
  stockQuantity: number | null;
  stockStatus: string;
  name: string;
  lineId: number;
};

export async function fetchLiveStockLinesForCart(
  items: CartStockItem[],
  formula: StockFormula
): Promise<{ lines: LiveStockLine[]; errors: CartStockFetchError[] }> {
  const errors: CartStockFetchError[] = [];
  const pending: PendingRow[] = [];

  const consumerKey = wpUtils.getWpConsumerKey();
  const consumerSecret = wpUtils.getWpConsumerSecret();
  if (!consumerKey || !consumerSecret) {
    return { lines: [], errors: [] };
  }

  for (const item of items) {
    const { product_id, variation_id, quantity } = item;
    const qty = Math.max(0, Number(quantity) || 0);
    if (qty < 1) continue;

    try {
      let stockQuantity: number | null = null;
      let stockStatus = 'instock';
      let name = '';

      if (variation_id) {
        const varUrl = wpUtils.buildWcApiUrl(`wc/v3/products/${product_id}/variations/${variation_id}`);
        const varRes = await fetch(varUrl, {
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000),
        });
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
        const prodRes = await fetch(prodUrl, {
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000),
        });
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
  const stockMap = await fetchYardsaleStockBatch(lineIds, formula);

  const lines: LiveStockLine[] = [];
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

    if (process.env.NUXT_DEBUG_CART_STOCK === 'true') {
      console.log('[cart-live-stock]', {
        lineId: row.lineId,
        product_id,
        variation_id,
        effectiveQty: stockQuantity,
        reserved: adj?.reserved_quantity,
      });
    }

    lines.push({
      product_id,
      ...(variation_id != null && variation_id > 0 ? { variation_id: Number(variation_id) } : {}),
      quantity: qty,
      name,
      stockQuantity,
      stockStatus,
    });
  }

  return { lines, errors };
}
