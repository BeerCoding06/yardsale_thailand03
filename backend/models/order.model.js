import { ilikeContainsPattern } from '../utils/pagination.js';

/** รูปหลักสินค้า — สำหรับแสดงในรายการออเดอร์ */
function primaryProductImageUrl(row) {
  const main = row.image_url != null ? String(row.image_url).trim() : '';
  if (main) return main;
  const arr = row.image_urls;
  if (Array.isArray(arr)) {
    for (const x of arr) {
      const s = String(x ?? '').trim();
      if (s) return s;
    }
  }
  return null;
}

/** แถวจาก JOIN order_items + products → รูปแบบส่ง API */
export function lineItemRowToApi(row) {
  const qty = Number(row.quantity);
  const price = Number(row.price);
  const oid = row.order_id;
  const pid = row.product_id;
  const idKey = oid && pid ? `${oid}-${pid}` : pid;
  return {
    id: idKey,
    product_id: pid,
    quantity: qty,
    price,
    name: row.name,
    image_url: primaryProductImageUrl(row),
    total: Number((qty * price).toFixed(2)),
  };
}

/** รวมคอลัมน์ wallet/จัดส่ง — ต้องรัน migration wallet (buyer_confirmed_delivery_at, funds_settled_at) */
const ORDER_SELECT_BASE = `id, user_id, total_price, status, slip_image_url, created_at,
  billing_snapshot, shipping_status, tracking_number, shipping_receipt_number, courier_name, fulfillment_updated_at,
  buyer_confirmed_delivery_at, funds_settled_at`;

const ORDER_O = ORDER_SELECT_BASE.split(',')
  .map((s) => `o.${s.trim()}`)
  .join(', ');

/** เมื่อ migration wallet ยังไม่รันบน orders — กัน 42703 บน list seller / admin orders */
const ORDER_SELECT_NO_WALLET = `id, user_id, total_price, status, slip_image_url, created_at,
  billing_snapshot, shipping_status, tracking_number, shipping_receipt_number, courier_name, fulfillment_updated_at`;
const ORDER_O_NO_WALLET = ORDER_SELECT_NO_WALLET.split(',')
  .map((s) => `o.${s.trim()}`)
  .join(', ');

/** คอลัมน์จาก CREATE TABLE orders ต้นฉบับ — ใช้เมื่อ SELECT เต็มล้ม (42703) เพื่อกัน my-orders 500 */
const ORDER_LIST_USER_CORE = `id, user_id, total_price, status, slip_image_url, created_at`;

const ORDER_O_CORE = ORDER_LIST_USER_CORE.split(',')
  .map((s) => `o.${s.trim()}`)
  .join(', ');

const ORDER_RETURNING_CHAIN = [ORDER_SELECT_BASE, ORDER_SELECT_NO_WALLET, ORDER_LIST_USER_CORE];

/** true = อยู่ใน BEGIN block — ต้องใช้ SAVEPOINT ก่อนลองซ้ำหลัง 42703 (กัน 25P02) */
async function useSavepointsFor42703Retry(client) {
  try {
    await client.query('SAVEPOINT __ordret_tx_probe__');
    await client.query('ROLLBACK TO SAVEPOINT __ordret_tx_probe__');
    await client.query('RELEASE SAVEPOINT __ordret_tx_probe__');
    return true;
  } catch (probeErr) {
    const c = String(probeErr?.code || '');
    if (c === '25P01' || /savepoint.*transaction|no active sql transaction/i.test(String(probeErr?.message || ''))) {
      return false;
    }
    throw probeErr;
  }
}

/**
 * 42703 = คอลัมน์ orders ไม่ตรง migration
 * ภายใน BEGIN… transaction: ถ้า query แรกล้ม ต้อง ROLLBACK TO SAVEPOINT ก่อนลองชุดคอลัมน์ถัดไป — ไม่งั้นได้ 25P02
 */
async function queryWithOrderReturningFallback(client, sqlForCols, params) {
  const useSavepoints = await useSavepointsFor42703Retry(client);

  let lastErr;
  for (let i = 0; i < ORDER_RETURNING_CHAIN.length; i++) {
    const cols = ORDER_RETURNING_CHAIN[i];
    const sp = `sp_ordret_${i}`;
    if (useSavepoints) {
      await client.query(`SAVEPOINT ${sp}`);
    }
    try {
      const r = await client.query(sqlForCols(cols), params);
      if (useSavepoints) {
        await client.query(`RELEASE SAVEPOINT ${sp}`);
      }
      return r;
    } catch (err) {
      if (useSavepoints) {
        await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
        await client.query(`RELEASE SAVEPOINT ${sp}`);
      }
      if (err?.code !== '42703') throw err;
      lastErr = err;
    }
  }
  throw lastErr;
}

export async function createOrderRow(client, { userId, totalPrice, status = 'pending', billingSnapshot = null }) {
  const billingJson = billingSnapshot ? JSON.stringify(billingSnapshot) : null;
  const withBilling = (cols) =>
    `INSERT INTO orders (user_id, total_price, status, billing_snapshot)
     VALUES ($1, $2, $3::order_status, $4::jsonb)
     RETURNING ${cols}`;
  const noBillingCols = (cols) =>
    `INSERT INTO orders (user_id, total_price, status)
     VALUES ($1, $2, $3::order_status)
     RETURNING ${cols}`;

  try {
    const r = await queryWithOrderReturningFallback(
      client,
      withBilling,
      [userId, totalPrice, status, billingJson]
    );
    return r.rows[0];
  } catch (err) {
    /** ฐานเก่าไม่มี billing_snapshot ใน INSERT — 42703 จากคอลัมน์ใน INSERT ไม่แก้ด้วยแค่เปลี่ยน RETURNING */
    if (err?.code !== '42703') throw err;
    const r2 = await queryWithOrderReturningFallback(client, noBillingCols, [userId, totalPrice, status]);
    return r2.rows[0];
  }
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

/** ค่า UUID จาก FormData / query — cast ใน SQL กันค่า string ไม่ตรงชนิด */
function asOrderUuid(orderId) {
  return String(orderId ?? '').trim();
}

export async function getOrderById(client, orderId) {
  const id = asOrderUuid(orderId);
  const r = await queryWithOrderReturningFallback(
    client,
    (cols) => `SELECT ${cols} FROM orders WHERE id = $1::uuid`,
    [id]
  );
  return r.rows[0] || null;
}

export async function getOrderItems(client, orderId) {
  const id = asOrderUuid(orderId);
  const withUrls = `SELECT oi.order_id, oi.product_id, oi.quantity, oi.price, p.name, p.image_url, p.image_urls
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1::uuid`;
  const noUrls = `SELECT oi.order_id, oi.product_id, oi.quantity, oi.price, p.name, p.image_url
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1::uuid`;
  const useSp = await useSavepointsFor42703Retry(client);
  let r;
  if (useSp) await client.query('SAVEPOINT sp_get_order_items_1');
  try {
    r = await client.query(withUrls, [id]);
    if (useSp) await client.query('RELEASE SAVEPOINT sp_get_order_items_1');
  } catch (err) {
    if (useSp) {
      await client.query('ROLLBACK TO SAVEPOINT sp_get_order_items_1');
      await client.query('RELEASE SAVEPOINT sp_get_order_items_1');
    }
    if (err?.code !== '42703') throw err;
    if (useSp) await client.query('SAVEPOINT sp_get_order_items_2');
    try {
      r = await client.query(noUrls, [id]);
      if (useSp) await client.query('RELEASE SAVEPOINT sp_get_order_items_2');
    } catch (err2) {
      if (useSp) {
        await client.query('ROLLBACK TO SAVEPOINT sp_get_order_items_2');
        await client.query('RELEASE SAVEPOINT sp_get_order_items_2');
      }
      throw err2;
    }
  }
  return r.rows.map(lineItemRowToApi);
}

export async function updateOrderStatus(client, orderId, status, { slipImageUrl } = {}) {
  const id = asOrderUuid(orderId);
  const r = await queryWithOrderReturningFallback(
    client,
    (cols) =>
      `UPDATE orders
       SET status = $2::order_status,
           slip_image_url = COALESCE($3, slip_image_url)
       WHERE id = $1::uuid
       RETURNING ${cols}`,
    [id, status, slipImageUrl ?? null]
  );
  return r.rows[0] || null;
}

/** ผู้ขายที่มีสินค้าในออเดอร์ — อัปเดตสถานะจัดส่งและเลขพัสดุ */
export async function updateOrderFulfillment(client, orderId, fields) {
  const id = asOrderUuid(orderId);
  const r = await queryWithOrderReturningFallback(
    client,
    (cols) =>
      `UPDATE orders SET
      shipping_status = $2,
      tracking_number = NULLIF(TRIM(COALESCE($3, '')), ''),
      shipping_receipt_number = NULLIF(TRIM(COALESCE($4, '')), ''),
      courier_name = NULLIF(TRIM(COALESCE($5, '')), ''),
      fulfillment_updated_at = now()
    WHERE id = $1::uuid
    RETURNING ${cols}`,
    [
      id,
      fields.shipping_status,
      fields.tracking_number ?? '',
      fields.shipping_receipt_number ?? '',
      fields.courier_name ?? '',
    ]
  );
  return r.rows[0] || null;
}

/** แอดมินแก้ยอดรวมออเดอร์ */
export async function updateOrderTotalPrice(client, orderId, totalPrice) {
  const id = asOrderUuid(orderId);
  const r = await queryWithOrderReturningFallback(
    client,
    (cols) => `UPDATE orders SET total_price = $2::numeric WHERE id = $1::uuid RETURNING ${cols}`,
    [id, totalPrice]
  );
  return r.rows[0] || null;
}

export async function listOrdersForUser(client, userId) {
  try {
    const r = await client.query(
      `SELECT ${ORDER_SELECT_BASE}
       FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return r.rows;
  } catch (err) {
    if (err?.code !== '42703') throw err;
    const r = await client.query(
      `SELECT ${ORDER_LIST_USER_CORE}
       FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return r.rows;
  }
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
  const tail = `
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     JOIN products p ON p.id = oi.product_id
     LEFT JOIN users u ON u.id = o.user_id
     WHERE p.seller_id = $1
     ORDER BY o.created_at DESC`;
  const qFull = `SELECT DISTINCT ${ORDER_O}, u.email AS buyer_email, u.name AS buyer_name${tail}`;
  const qCore = `SELECT DISTINCT ${ORDER_O_NO_WALLET}, u.email AS buyer_email, u.name AS buyer_name${tail}`;
  try {
    const r = await client.query(qFull, [sellerId]);
    return r.rows;
  } catch (err) {
    if (err?.code !== '42703') throw err;
    const r2 = await client.query(qCore, [sellerId]);
    return r2.rows;
  }
}

/** All orders (admin) */
export async function listAllOrders(client) {
  const qFull = `SELECT ${ORDER_O},
            u.email AS buyer_email
     FROM orders o
     LEFT JOIN users u ON u.id = o.user_id
     ORDER BY o.created_at DESC`;
  const qCore = `SELECT ${ORDER_O_NO_WALLET},
            u.email AS buyer_email
     FROM orders o
     LEFT JOIN users u ON u.id = o.user_id
     ORDER BY o.created_at DESC`;
  try {
    const r = await client.query(qFull);
    return r.rows;
  } catch (err) {
    if (err?.code !== '42703') throw err;
    const r2 = await client.query(qCore);
    return r2.rows;
  }
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

/** ค้นหาเมื่อ billing_snapshot ยังไม่มีในฐานข้อมูล — หลีกเลี่ยง 42703 ใน WHERE */
function userOrderSearchConditionCore(likePattern, paramIndex) {
  if (!likePattern) return { sql: '', params: [] };
  return {
    sql: ` AND (
      CAST(o.id AS TEXT) ILIKE $${paramIndex} ESCAPE '\\'
      OR o.status::text ILIKE $${paramIndex} ESCAPE '\\'
    )`,
    params: [likePattern],
  };
}

export async function countOrdersForUser(client, userId, search) {
  const like = ilikeContainsPattern(search);
  const cond = userOrderSearchCondition(like, 2);
  const params = [userId, ...cond.params];
  try {
    const r = await client.query(
      `SELECT COUNT(*)::int AS c FROM orders o WHERE o.user_id = $1::uuid ${cond.sql}`,
      params
    );
    return r.rows[0]?.c ?? 0;
  } catch (err) {
    if (err?.code !== '42703') throw err;
    const cond2 = like ? userOrderSearchConditionCore(like, 2) : { sql: '', params: [] };
    const params2 = [userId, ...cond2.params];
    const r2 = await client.query(
      `SELECT COUNT(*)::int AS c FROM orders o WHERE o.user_id = $1::uuid ${cond2.sql}`,
      params2
    );
    return r2.rows[0]?.c ?? 0;
  }
}

export async function listOrdersForUserPaged(client, userId, { limit, offset, search }) {
  const like = ilikeContainsPattern(search);
  const cond = userOrderSearchCondition(like, 2);
  const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const off = Math.max(Number(offset) || 0, 0);
  const params = [userId, ...cond.params, lim, off];
  const iLim = params.length - 1;
  const iOff = params.length;
  const sqlFull = `SELECT ${ORDER_O}
     FROM orders o
     WHERE o.user_id = $1::uuid ${cond.sql}
     ORDER BY o.created_at DESC
     LIMIT $${iLim} OFFSET $${iOff}`;
  try {
    const r = await client.query(sqlFull, params);
    return r.rows;
  } catch (err) {
    if (err?.code !== '42703') throw err;
    const cond2 = like ? userOrderSearchConditionCore(like, 2) : { sql: '', params: [] };
    const params2 = [userId, ...cond2.params, lim, off];
    const iLim2 = params2.length - 1;
    const iOff2 = params2.length;
    const r2 = await client.query(
      `SELECT ${ORDER_O_CORE}
       FROM orders o
       WHERE o.user_id = $1::uuid ${cond2.sql}
       ORDER BY o.created_at DESC
       LIMIT $${iLim2} OFFSET $${iOff2}`,
      params2
    );
    return r2.rows;
  }
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
  const sql = (orderCols) =>
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
     SELECT ${orderCols},
            u.email AS buyer_email, u.name AS buyer_name
     FROM orders o
     JOIN paged p ON p.id = o.id
     LEFT JOIN users u ON u.id = o.user_id
     ORDER BY o.created_at DESC`;
  try {
    const r = await client.query(sql(ORDER_O), params);
    return r.rows;
  } catch (err) {
    if (err?.code !== '42703') throw err;
    const r2 = await client.query(sql(ORDER_O_NO_WALLET), params);
    return r2.rows;
  }
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
  const qFull = `SELECT ${ORDER_O},
            u.email AS buyer_email
     FROM orders o
     LEFT JOIN users u ON u.id = o.user_id
     WHERE 1=1 ${extra}
     ORDER BY o.created_at DESC
     LIMIT $${iLim} OFFSET $${iOff}`;
  const qCore = `SELECT ${ORDER_O_NO_WALLET},
            u.email AS buyer_email
     FROM orders o
     LEFT JOIN users u ON u.id = o.user_id
     WHERE 1=1 ${extra}
     ORDER BY o.created_at DESC
     LIMIT $${iLim} OFFSET $${iOff}`;
  try {
    const r = await client.query(qFull, params);
    return r.rows;
  } catch (err) {
    if (err?.code !== '42703') throw err;
    const r2 = await client.query(qCore, params);
    return r2.rows;
  }
}

/** รายการสินค้าต่อออเดอร์ (ทุกบรรทัด) — ใช้หน้ารายการออเดอร์แอดมิน */
export async function mapLineItemsByOrderIds(client, orderIds) {
  if (!orderIds.length) return new Map();
  const withUrls = `SELECT oi.order_id, oi.product_id, oi.quantity, oi.price, p.name, p.image_url, p.image_urls
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ANY($1::uuid[])
     ORDER BY oi.order_id, p.name`;
  const noUrls = `SELECT oi.order_id, oi.product_id, oi.quantity, oi.price, p.name, p.image_url
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ANY($1::uuid[])
     ORDER BY oi.order_id, p.name`;
  let r;
  try {
    r = await client.query(withUrls, [orderIds]);
  } catch (err) {
    if (err?.code !== '42703') throw err;
    r = await client.query(noUrls, [orderIds]);
  }
  const map = new Map();
  for (const row of r.rows) {
    const oid = row.order_id;
    if (!map.has(oid)) map.set(oid, []);
    map.get(oid).push(lineItemRowToApi(row));
  }
  return map;
}

/** เฉพาะบรรทัดที่ seller นี้เป็นผู้ขาย — ใช้หน้าผู้ขาย */
export async function insertOrderSlipSnapshot(client, { orderId, imageUrl }) {
  const id = asOrderUuid(orderId);
  const r = await client.query(
    `INSERT INTO order_slip_snapshots (order_id, image_url)
     VALUES ($1::uuid, $2)
     RETURNING id, order_id, image_url, created_at`,
    [id, imageUrl != null && String(imageUrl).trim() !== '' ? String(imageUrl).trim() : null]
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
  const withUrls = `SELECT oi.order_id, oi.product_id, oi.quantity, oi.price, p.name, p.image_url, p.image_urls
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ANY($1::uuid[]) AND p.seller_id = $2::uuid
     ORDER BY oi.order_id, p.name`;
  const noUrls = `SELECT oi.order_id, oi.product_id, oi.quantity, oi.price, p.name, p.image_url
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ANY($1::uuid[]) AND p.seller_id = $2::uuid
     ORDER BY oi.order_id, p.name`;
  let r;
  try {
    r = await client.query(withUrls, [orderIds, sellerId]);
  } catch (err) {
    if (err?.code !== '42703') throw err;
    r = await client.query(noUrls, [orderIds, sellerId]);
  }
  const map = new Map();
  for (const row of r.rows) {
    const oid = row.order_id;
    if (!map.has(oid)) map.set(oid, []);
    map.get(oid).push(lineItemRowToApi(row));
  }
  return map;
}

export async function lockOrderForUpdate(client, orderId) {
  const id = asOrderUuid(orderId);
  const r = await queryWithOrderReturningFallback(
    client,
    (cols) => `SELECT ${cols} FROM orders WHERE id = $1::uuid FOR UPDATE`,
    [id]
  );
  return r.rows[0] || null;
}

/** ยอดรวมต่อผู้ขายในออเดอร์ (สำหรับ escrow / release) */
export async function listSellerSubtotalsForOrder(client, orderId) {
  const id = asOrderUuid(orderId);
  const r = await client.query(
    `SELECT p.seller_id,
            SUM(oi.quantity * oi.price)::numeric(14,2) AS amount
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1::uuid
     GROUP BY p.seller_id`,
    [id]
  );
  return r.rows.map((row) => ({
    seller_id: row.seller_id,
    amount: Number(row.amount),
  }));
}

export async function countSellersWithPositiveShareForOrder(client, orderId) {
  const id = asOrderUuid(orderId);
  const r = await client.query(
    `SELECT COUNT(*)::int AS n FROM (
       SELECT p.seller_id
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1::uuid
       GROUP BY p.seller_id
       HAVING SUM(oi.quantity * oi.price) > 0
     ) t`,
    [id]
  );
  return r.rows[0]?.n ?? 0;
}

export async function setBuyerConfirmedDeliveryAt(client, orderId) {
  const id = asOrderUuid(orderId);
  const r = await client.query(
    `UPDATE orders SET buyer_confirmed_delivery_at = COALESCE(buyer_confirmed_delivery_at, now())
     WHERE id = $1::uuid
     RETURNING ${ORDER_SELECT_BASE}`,
    [id]
  );
  return r.rows[0] || null;
}

export async function setFundsSettledAtIfUnset(client, orderId) {
  const id = asOrderUuid(orderId);
  const r = await client.query(
    `UPDATE orders SET funds_settled_at = now()
     WHERE id = $1::uuid AND funds_settled_at IS NULL
     RETURNING ${ORDER_SELECT_BASE}`,
    [id]
  );
  return r.rows[0] || null;
}

export async function adminSetShippingDelivered(client, orderId) {
  const id = asOrderUuid(orderId);
  const r = await client.query(
    `UPDATE orders SET
       shipping_status = 'delivered',
       fulfillment_updated_at = now()
     WHERE id = $1::uuid
     RETURNING ${ORDER_SELECT_BASE}`,
    [id]
  );
  return r.rows[0] || null;
}
