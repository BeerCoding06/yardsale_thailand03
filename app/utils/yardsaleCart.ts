/**
 * แมปแถวตะกร้าจาก Express (cart_items + products) → รูปแบบ CartItem ที่ UI (Woo-like) ใช้
 */
export type ServerCartRow = {
  product_id: string;
  quantity: number;
  name: string;
  price: string | number;
  stock: number;
  is_cancelled?: boolean;
  image_url?: string | null;
};

/**
 * สร้างบรรทัดตะกร้า (รูปแบบ Woo-like) จากแถวสินค้า API สาธารณะ — ใช้ตะกร้า guest โดยไม่เรียก POST /cart/add
 */
export function yardsaleProductRowToCartItem(
  p: Record<string, unknown>,
  quantity: number,
  resolveMediaUrl: (url: string | null | undefined) => string | undefined
): { key: string; quantity: number; product: { node: Record<string, unknown> } } | null {
  const id = p.id != null ? String(p.id) : "";
  if (!id) return null;
  const row: ServerCartRow = {
    product_id: id,
    quantity: Math.max(1, Math.floor(Number(quantity)) || 1),
    name: String(p.name ?? ""),
    price: p.price ?? 0,
    stock: Number(p.stock ?? 0),
    is_cancelled: p.is_cancelled === true,
    image_url: (p.image_url as string) || null,
  };
  const items = serverCartRowsToCartItems([row], resolveMediaUrl);
  return items[0] ?? null;
}

export function serverCartRowsToCartItems(
  rows: ServerCartRow[] | null | undefined,
  resolveMediaUrl: (url: string | null | undefined) => string | undefined
): Array<{
  key: string;
  quantity: number;
  product: { node: Record<string, unknown> };
}> {
  if (!Array.isArray(rows) || !rows.length) return [];
  return rows.map((row) => {
    const pid = String(row.product_id);
    const priceNum = Number(row.price);
    const stock = Number(row.stock);
    const cancelled = row.is_cancelled === true;
    const inStock = !cancelled && stock > 0;
    const img = resolveMediaUrl(row.image_url || null);
    const node: Record<string, unknown> = {
      id: pid,
      databaseId: pid,
      name: row.name,
      slug: "",
      regularPrice: Number.isFinite(priceNum) ? String(priceNum) : "0",
      salePrice: null,
      stockQuantity: stock,
      stockStatus: inStock ? "IN_STOCK" : "OUT_OF_STOCK",
    };
    if (img) node.image = { sourceUrl: img };
    return {
      key: `yardsale:${pid}`,
      quantity: Math.max(1, Number(row.quantity) || 1),
      product: { node },
    };
  });
}
