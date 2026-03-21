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
