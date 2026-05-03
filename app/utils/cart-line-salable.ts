/**
 * WooCommerce บางครั้งค้าง stock_status = outofstock ทั้งที่ stock_quantity พอ
 * (เช่น สินค้าเคยถูกยกเลิก/แก้สต็อกใน WC แล้วแต่สถานะไม่อัปเดต)
 * ถ้ามีจำนวนสต็อกชัดเจนและเพียงพอต่อ qty ในตะกร้า ให้ถือว่าขายได้
 */
export function isCartLineSalableBySnapshot(
  stockStatus: string | null | undefined,
  stockQuantity: number | null | undefined,
  cartQty: number
): boolean {
  const qty = Math.max(1, Number(cartQty) || 1);
  const sq =
    stockQuantity != null && stockQuantity !== undefined && !Number.isNaN(Number(stockQuantity))
      ? Number(stockQuantity)
      : null;

  const normalized = (stockStatus ?? '')
    .toString()
    .toUpperCase()
    .replace(/\s/g, '_');

  if (normalized === 'ONBACKORDER' || normalized === 'ON_BACKORDER') {
    return true;
  }

  if (sq !== null && sq >= qty && sq >= 1) {
    return true;
  }

  if (normalized === 'OUT_OF_STOCK' || normalized === 'OUTOFSTOCK') {
    return false;
  }

  if (sq !== null && sq < 1) return false;
  if (sq !== null && qty > sq) return false;
  return true;
}

type CartLineLike = {
  quantity?: number;
  product?: { node?: { stockQuantity?: unknown; stockStatus?: unknown } };
  variation?: { node?: { stockQuantity?: unknown; stockStatus?: unknown } };
};

/**
 * ปรับจำนวนในแต่ละบรรทัดให้ไม่เกินสต็อกที่ snapshot บอก — หมดสต็อกแล้วลบบรรทัดออก
 */
export function clampCartQuantitiesToStock<T extends CartLineLike>(items: T[]): T[] {
  const out: T[] = [];
  for (const item of items) {
    const raw =
      item.variation?.node?.stockQuantity ?? item.product?.node?.stockQuantity ?? null;
    const stockStatus =
      item.variation?.node?.stockStatus ?? item.product?.node?.stockStatus;
    let stockQuantity: number | null = null;
    if (raw != null && raw !== '') {
      const n = Number(raw);
      if (Number.isFinite(n)) stockQuantity = n;
    }
    const qty = Math.max(1, Number(item.quantity) || 1);
    const norm = (stockStatus ?? '')
      .toString()
      .toUpperCase()
      .replace(/\s/g, '_');

    if (norm === 'OUT_OF_STOCK' || norm === 'OUTOFSTOCK') continue;

    if (stockQuantity != null && Number.isFinite(stockQuantity)) {
      const sq = Math.floor(stockQuantity);
      if (sq < 1) continue;
      const newQty = Math.min(qty, sq);
      out.push({ ...item, quantity: newQty } as T);
      continue;
    }

    if (!isCartLineSalableBySnapshot(stockStatus, stockQuantity, qty)) {
      if (isCartLineSalableBySnapshot(stockStatus, stockQuantity, 1)) {
        out.push({ ...item, quantity: 1 } as T);
      }
      continue;
    }
    out.push({ ...item, quantity: qty } as T);
  }
  return out;
}
