export async function getOrCreateCart(client, userId) {
  const existing = await client.query(`SELECT id FROM carts WHERE user_id = $1`, [userId]);
  if (existing.rows[0]) return existing.rows[0].id;
  const r = await client.query(
    `INSERT INTO carts (user_id) VALUES ($1) RETURNING id`,
    [userId]
  );
  return r.rows[0].id;
}

export async function getCartItems(client, cartId) {
  const r = await client.query(
    `SELECT ci.product_id, ci.quantity, p.name, p.price, p.stock, p.is_cancelled
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     WHERE ci.cart_id = $1`,
    [cartId]
  );
  return r.rows;
}

export async function setCartItems(client, cartId, items) {
  await client.query(`DELETE FROM cart_items WHERE cart_id = $1`, [cartId]);
  for (const it of items) {
    if (it.quantity > 0) {
      await client.query(
        `INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)`,
        [cartId, it.product_id, it.quantity]
      );
    }
  }
  await client.query(`UPDATE carts SET updated_at = now() WHERE id = $1`, [cartId]);
}

export async function addOrUpdateItem(client, cartId, productId, quantity) {
  await client.query(
    `INSERT INTO cart_items (cart_id, product_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (cart_id, product_id)
     DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity`,
    [cartId, productId, quantity]
  );
  await client.query(`UPDATE carts SET updated_at = now() WHERE id = $1`, [cartId]);
}

export async function clearCart(client, cartId) {
  await client.query(`DELETE FROM cart_items WHERE cart_id = $1`, [cartId]);
  await client.query(`UPDATE carts SET updated_at = now() WHERE id = $1`, [cartId]);
}
