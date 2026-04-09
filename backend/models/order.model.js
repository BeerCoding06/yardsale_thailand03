import { ilikeContainsPattern } from '../utils/pagination.js';

const ORDER_SELECT_BASE = `id, user_id, total_price, status, slip_image_url, created_at,
  billing_snapshot, shipping_status, tracking_number, shipping_receipt_number, courier_name, fulfillment_updated_at`;

const ORDER_O = ORDER_SELECT_BASE.split(',')
  .map((s) => `o.${s.trim()}`)
  .join(', ');

export async function createOrderRow(client, { userId, totalPrice, status = 'pending', billingSnapshot = null }) {
  const r = await client.query(
    `INSERT INTO orders (user_id, total_price, status, billing_snapshot)
     VALUES ($1, $2, $3::order_status, $4::jsonb)
     RETURNING ${ORDER_SELECT_BASE}`,
    [userId, totalPrice, status, billingSnapshot ? JSON.stringify(billingSnapshot) : null]
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
    `SELECT ${ORDER_SELECT_BASE}
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
     RETURNING ${ORDER_SELECT_BASE}`,
    [orderId, status, slipImageUrl ?? null]
  );
  return r.rows[0] || null;
}

/** ผู้ขายที่มีสินค้าในออเดอร์ — อัปเดตสถานะจัดส่งและเลขพัสดุ */
export async function updateOrderFulfillment(client, orderId, fields) {
  const r = await client.query(
    `UPDATE orders SET
      shipping_status = $2,
      tracking_number = NULLIF(TRIM(COALESCE($3, '')), ''),
      shipping_receipt_number = NULLIF(TRIM(COALESCE($4, '')), ''),
      courier_name = NULLIF(TRIM(COALESCE($5, '')), ''),
      fulfillment_updated_at = now()
    WHERE id = $1
    RETURNING ${ORDER_SELECT_BASE}`,
    [
      orderId,
      fields.shipping_status,
      fields.tracking_number ?? '',
      fields.shipping_receipt_number ?? '',
      fields.courier_name ?? '',
    ]
  );
  return r.rows[0] || null;
}

export async function listOrdersForUser(client, userId) {
  const r = await client.query(
    `SELECT ${ORDER_SELECT_BASE}
     FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return r.rows;
}

export async function orderHasSellerProduct(client, orderId, sellerId) {
  const r = await client.query(
    `SELECT 1 FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1 AND p.seller_id = $2::uuid
     LIMIT 1`,
    [orderId, sellerId]
  );
  return r.rowCount > 0;
}

/** Orders that include at least one line item sold by sellerId */
export async function listOrdersForSeller(client, sellerId) {
  const r = await client.query(
    `SELECT DISTINCT o.id, o.user_id, o.total_price, o.status, o.slip_image_url, o.created_at,
            o.billing_snapshot, o.shipping_status, o.tracking_number, o.shipping_receipt_number,
            o.courier_name, o.fulfillment_updated_at,
            u.email AS buyer_email, u.name AS buyer_name
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     JOIN products p ON p.id = oi.product_id
     LEFT JOIN users u ON u.id = o.user_id
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
            o.billing_snapshot, o.shipping_status, o.tracking_number, o.shipping_receipt_number,
            o.courier_name, o.fulfillment_updated_at,
            u.email AS buyer_email
     FROM orders o
     LEFT JOIN users u ON u.id = o.user_id
     ORDER BY o.created_at DESC`
  );
  return r.rows;
}

function userOrderSearchCondition(likePattern, paramIndex) {
  if (!likePattern) return { sql: '', params: [] };
  return {
    sql: ` AND (
      CAST(o.id AS TEXT) ILIKE $${paramIndex} ESCAPE '\\'
      OR o.status::text ILIKE $${paramIndex} ESCAPE '\\'
      OR COALESCE(o.billing_snapshot->>'email','') ILIKE $${paramIndex} ESCAPE '\\'
    )`,
    params: [likePattern],
  };
}

export async function countOrdersForUser(client, userId, search) {
  const like = ilikeContainsPattern(search);
  const cond = userOrderSearchCondition(like, 2);
  const params = [userId, ...cond.params];
  const r = await client.query(
    `SELECT COUNT(*)::int AS c FROM orders o WHERE o.user_id = $1::uuid ${cond.sql}`,
    params
  );
  return r.rows[0]?.c ?? 0;
}

export async function listOrdersForUserPaged(client, userId, { limit, offset, search }) {
  const like = ilikeContainsPattern(search);
  const cond = userOrderSearchCondition(like, 2);
  const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const off = Math.max(Number(offset) || 0, 0);
  const params = [userId, ...cond.params, lim, off];
  const iLim = params.length - 1;
  const iOff = params.length;
  const r = await client.query(
    `SELECT ${ORDER_O}
     FROM orders o
     WHERE o.user_id = $1::uuid ${cond.sql}
     ORDER BY o.created_at DESC
     LIMIT $${iLim} OFFSET $${iOff}`,
    params
  );
  return r.rows;
}

export async function countOrdersForSeller(client, sellerId, search) {
  const like = ilikeContainsPattern(search);
  const params = [sellerId];
  let extra = '';
  if (like) {
    params.push(like);
    extra = ` AND (
      CAST(o.id AS TEXT) ILIKE $2 ESCAPE '\\'
      OR o.status::text ILIKE $2 ESCAPE '\\'
      OR COALESCE(u.email,'') ILIKE $2 ESCAPE '\\'
      OR COALESCE(u.name,'') ILIKE $2 ESCAPE '\\'
    )`;
  }
  const r = await client.query(
    `SELECT COUNT(DISTINCT o.id)::int AS c
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     JOIN products p ON p.id = oi.product_id
     LEFT JOIN users u ON u.id = o.user_id
     WHERE p.seller_id = $1::uuid ${extra}`,
    params
  );
  return r.rows[0]?.c ?? 0;
}

export async function listOrdersForSellerPaged(client, sellerId, { limit, offset, search }) {
  const like = ilikeContainsPattern(search);
  const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const off = Math.max(Number(offset) || 0, 0);
  const params = [sellerId];
  let searchSql = '';
  if (like) {
    params.push(like);
    searchSql = ` AND (
      CAST(o.id AS TEXT) ILIKE $2 ESCAPE '\\'
      OR o.status::text ILIKE $2 ESCAPE '\\'
      OR COALESCE(u.email,'') ILIKE $2 ESCAPE '\\'
      OR COALESCE(u.name,'') ILIKE $2 ESCAPE '\\'
    )`;
  }
  params.push(lim, off);
  const iLim = params.length - 1;
  const iOff = params.length;
  const r = await client.query(
    `WITH seller_ids AS (
       SELECT DISTINCT o.id, o.created_at
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       LEFT JOIN users u ON u.id = o.user_id
       WHERE p.seller_id = $1::uuid ${searchSql}
     ),
     paged AS (
       SELECT id FROM seller_ids ORDER BY created_at DESC LIMIT $${iLim} OFFSET $${iOff}
     )
     SELECT ${ORDER_O},
            u.email AS buyer_email, u.name AS buyer_name
     FROM orders o
     JOIN paged p ON p.id = o.id
     LEFT JOIN users u ON u.id = o.user_id
     ORDER BY o.created_at DESC`,
    params
  );
  return r.rows;
}

export async function countAllOrders(client, search) {
  const like = ilikeContainsPattern(search);
  const params = [];
  let extra = '';
  if (like) {
    params.push(like);
    extra = ` AND (
      CAST(o.id AS TEXT) ILIKE $1 ESCAPE '\\'
      OR o.status::text ILIKE $1 ESCAPE '\\'
      OR COALESCE(u.email,'') ILIKE $1 ESCAPE '\\'
    )`;
  }
  const r = await client.query(
    `SELECT COUNT(*)::int AS c
     FROM orders o
     LEFT JOIN users u ON u.id = o.user_id
     WHERE 1=1 ${extra}`,
    params
  );
  return r.rows[0]?.c ?? 0;
}

export async function listAllOrdersPaged(client, { limit, offset, search }) {
  const like = ilikeContainsPattern(search);
  const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const off = Math.max(Number(offset) || 0, 0);
  const params = [];
  let extra = '';
  if (like) {
    params.push(like);
    extra = ` AND (
      CAST(o.id AS TEXT) ILIKE $1 ESCAPE '\\'
      OR o.status::text ILIKE $1 ESCAPE '\\'
      OR COALESCE(u.email,'') ILIKE $1 ESCAPE '\\'
    )`;
  }
  params.push(lim, off);
  const iLim = params.length - 1;
  const iOff = params.length;
  const r = await client.query(
    `SELECT o.id, o.user_id, o.total_price, o.status, o.slip_image_url, o.created_at,
            o.billing_snapshot, o.shipping_status, o.tracking_number, o.shipping_receipt_number,
            o.courier_name, o.fulfillment_updated_at,
            u.email AS buyer_email
     FROM orders o
     LEFT JOIN users u ON u.id = o.user_id
     WHERE 1=1 ${extra}
     ORDER BY o.created_at DESC
     LIMIT $${iLim} OFFSET $${iOff}`,
    params
  );
  return r.rows;
}

/** รายการสินค้าต่อออเดอร์ (ทุกบรรทัด) — ใช้หน้ารายการออเดอร์แอดมิน */
export async function mapLineItemsByOrderIds(client, orderIds) {
  if (!orderIds.length) return new Map();
  const r = await client.query(
    `SELECT oi.order_id, oi.product_id, oi.quantity, oi.price, p.name
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ANY($1::uuid[])
     ORDER BY oi.order_id, p.name`,
    [orderIds]
  );
  const map = new Map();
  for (const row of r.rows) {
    const oid = row.order_id;
    if (!map.has(oid)) map.set(oid, []);
    map.get(oid).push({
      product_id: row.product_id,
      quantity: row.quantity,
      price: row.price,
      name: row.name,
    });
  }
  return map;
}

/** เฉพาะบรรทัดที่ seller นี้เป็นผู้ขาย — ใช้หน้าผู้ขาย */
export async function insertOrderSlipSnapshot(client, { orderId, imageUrl }) {
  const r = await client.query(
    `INSERT INTO order_slip_snapshots (order_id, image_url)
     VALUES ($1, $2)
     RETURNING id, order_id, image_url, created_at`,
    [orderId, imageUrl != null && String(imageUrl).trim() !== '' ? String(imageUrl).trim() : null]
  );
  return r.rows[0] || null;
}

export async function mapSlipSnapshotsByOrderIds(client, orderIds) {
  if (!orderIds.length) return new Map();
  const r = await client.query(
    `SELECT id, order_id, image_url, created_at
     FROM order_slip_snapshots
     WHERE order_id = ANY($1::uuid[])
     ORDER BY order_id, created_at ASC`,
    [orderIds]
  );
  const map = new Map();
  for (const row of r.rows) {
    const oid = row.order_id;
    if (!map.has(oid)) map.set(oid, []);
    map.get(oid).push({
      id: row.id,
      image_url: row.image_url,
      created_at: row.created_at,
    });
  }
  return map;
}

export async function mapSellerLineItemsByOrderIds(client, sellerId, orderIds) {
  if (!orderIds.length) return new Map();
  const r = await client.query(
    `SELECT oi.order_id, oi.product_id, oi.quantity, oi.price, p.name
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ANY($1::uuid[]) AND p.seller_id = $2::uuid
     ORDER BY oi.order_id, p.name`,
    [orderIds, sellerId]
  );
  const map = new Map();
  for (const row of r.rows) {
    const oid = row.order_id;
    if (!map.has(oid)) map.set(oid, []);
    map.get(oid).push({
      product_id: row.product_id,
      quantity: row.quantity,
      price: row.price,
      name: row.name,
    });
  }
  return map;
}
