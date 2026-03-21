/**
 * Same rules as app/utils/cart-line-salable.ts (keep in sync)
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
