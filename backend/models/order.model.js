export async function createOrderRow(client, { userId, totalPrice, status = 'pending' }) {
  const r = await client.query(
    `INSERT INTO orders (user_id, total_price, status)
     VALUES ($1, $2, $3::order_status)
     RETURNING id, user_id, total_price, status, slip_image_url, created_at`,
    [userId, totalPrice, status]
  );
  return r.rows[0];
}

export async function insertOrderItems(client, orderId, items) {
  for (const it of items) {
    await client.query(
      `INSERT INTO order_items (order_id, product_id, quantity, price)
       VALUES ($1, $2, $3, $4)`,
      [orderId, it.product_id, it.quantity, it.price]
    );
  }
}

export async function getOrderById(client, orderId) {
  const r = await client.query(
    `SELECT id, user_id, total_price, status, slip_image_url, created_at
     FROM orders WHERE id = $1`,
    [orderId]
  );
  return r.rows[0] || null;
}

export async function getOrderItems(client, orderId) {
  const r = await client.query(
    `SELECT oi.product_id, oi.quantity, oi.price, p.name
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1`,
    [orderId]
  );
  return r.rows;
}

export async function updateOrderStatus(client, orderId, status, { slipImageUrl } = {}) {
  const r = await client.query(
    `UPDATE orders
     SET status = $2::order_status,
         slip_image_url = COALESCE($3, slip_image_url)
     WHERE id = $1
     RETURNING id, user_id, total_price, status, slip_image_url, created_at`,
    [orderId, status, slipImageUrl ?? null]
  );
  return r.rows[0] || null;
}

export async function listOrdersForUser(client, userId) {
  const r = await client.query(
    `SELECT id, user_id, total_price, status, slip_image_url, created_at
     FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return r.rows;
}

/** Orders that include at least one line item sold by sellerId */
export async function listOrdersForSeller(client, sellerId) {
  const r = await client.query(
    `SELECT DISTINCT o.id, o.user_id, o.total_price, o.status, o.slip_image_url, o.created_at
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     JOIN products p ON p.id = oi.product_id
     WHERE p.seller_id = $1
     ORDER BY o.created_at DESC`,
    [sellerId]
  );
  return r.rows;
}

/** All orders (admin) */
export async function listAllOrders(client) {
  const r = await client.query(
    `SELECT o.id, o.user_id, o.total_price, o.status, o.slip_image_url, o.created_at,
            u.email AS buyer_email
     FROM orders o
     LEFT JOIN users u ON u.id = o.user_id
     ORDER BY o.created_at DESC`
  );
  return r.rows;
}
