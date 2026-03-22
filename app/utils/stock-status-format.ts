/**
 * แปลง stock_status จาก API (instock / outofstock) → รูปแบบในตะกร้า (IN_STOCK / OUT_OF_STOCK)
 */
export function wcStatusToCartStockToken(status: string | null | undefined): string {
  const s = (status ?? '')
    .toString()
    .toLowerCase()
    .replace(/\s/g, '');
  return s === 'outofstock' ? 'OUT_OF_STOCK' : 'IN_STOCK';
}
