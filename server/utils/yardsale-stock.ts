// server/utils/yardsale-stock.ts
// เรียก WordPress yardsale/v1 สำหรับคำนวณสต็อกหลังหักยอดชำระแล้ว

import { getWpBaseUrl } from './wp';

export type StockFormula = 'subtract_paid' | 'wc_only';

export type YardsaleStockRow = {
  line_id: number;
  paid_quantity: number;
  wc_stock_quantity: number | null;
  effective_quantity: number | null;
  effective_status: string;
};

export type YardsaleProductStockInfo = {
  product_id: number;
  formula: StockFormula;
  simple: YardsaleStockRow | null;
  variations: YardsaleStockRow[];
};

function wpJsonUrl(path: string): string {
  const base = getWpBaseUrl().replace(/\/$/, '');
  return `${base}/wp-json${path.startsWith('/') ? path : `/${path}`}`;
}

/** แปลง effective_status จากปลั๊กอิน → รูปแบบเดียวกับ getProduct (IN_STOCK / OUT_OF_STOCK) */
export function yardsaleEffectiveStatusToFrontend(status: string | undefined): string {
  const s = (status || '').toLowerCase();
  return s === 'outofstock' ? 'OUT_OF_STOCK' : 'IN_STOCK';
}

export async function fetchYardsaleProductStockInfo(
  productId: number,
  formula: StockFormula
): Promise<YardsaleProductStockInfo | null> {
  if (!productId || productId < 1) return null;
  const url = new URL(wpJsonUrl('/yardsale/v1/product-stock-info'));
  url.searchParams.set('product_id', String(productId));
  url.searchParams.set('formula', formula);
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as YardsaleProductStockInfo;
    if (!data || typeof data.product_id !== 'number') return null;
    return data;
  } catch (e) {
    console.warn('[yardsale-stock] product-stock-info failed:', (e as Error)?.message || e);
    return null;
  }
}

export async function fetchYardsaleStockBatch(
  lineIds: number[],
  formula: StockFormula
): Promise<Map<number, YardsaleStockRow>> {
  const map = new Map<number, YardsaleStockRow>();
  const ids = [...new Set(lineIds.map((n) => Math.floor(Number(n))).filter((n) => n > 0))];
  if (ids.length === 0) return map;

  const url = wpJsonUrl('/yardsale/v1/product-stock-batch');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, formula }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return map;
    const data = (await res.json()) as { lines?: YardsaleStockRow[] };
    for (const row of data?.lines || []) {
      if (row && typeof row.line_id === 'number') {
        map.set(row.line_id, row);
      }
    }
  } catch (e) {
    console.warn('[yardsale-stock] product-stock-batch failed:', (e as Error)?.message || e);
  }
  return map;
}

/**
 * ผสาน effective stock เข้า object product จาก getProduct.php / GraphQL shape
 */
export function mergeEffectiveStockIntoProduct(
  product: Record<string, any> | null | undefined,
  info: YardsaleProductStockInfo | null
): void {
  if (!product || !info) return;

  if (info.simple && product.databaseId === info.simple.line_id) {
    const s = info.simple;
    if (s.effective_quantity != null) {
      product.stockQuantity = s.effective_quantity;
      product.stockStatus = yardsaleEffectiveStatusToFrontend(s.effective_status);
    }
  }

  const nodes = product.variations?.nodes;
  if (!Array.isArray(nodes)) return;

  for (const v of nodes) {
    const vid = v?.databaseId;
    if (vid == null) continue;
    const row = info.variations?.find((r) => r.line_id === vid);
    if (!row) continue;
    if (row.effective_quantity != null) {
      v.stockQuantity = row.effective_quantity;
      v.stockStatus = yardsaleEffectiveStatusToFrontend(row.effective_status);
    }
  }
}
