/**
 * @param {import('pg').PoolClient} client
 * @param {{ userId: string, token: string, device?: string }} p
 */
export async function upsertToken(client, { userId, token, device }) {
  const dev = device && String(device).trim() ? String(device).trim() : 'web';
  const r = await client.query(
    `INSERT INTO fcm_tokens (user_id, token, device)
     VALUES ($1::uuid, $2, $3)
     ON CONFLICT (token) DO UPDATE
     SET user_id = EXCLUDED.user_id,
         device = EXCLUDED.device,
         updated_at = now()
     RETURNING id, user_id, token, device, created_at, updated_at`,
    [userId, token, dev]
  );
  return r.rows[0];
}

/** @param {import('pg').PoolClient} client */
export async function listTokensForUser(client, userId) {
  const r = await client.query(`SELECT token FROM fcm_tokens WHERE user_id = $1::uuid`, [userId]);
  return r.rows.map((x) => x.token);
}

/** @param {import('pg').PoolClient} client */
export async function listTokensForUsers(client, userIds) {
  if (!userIds?.length) return [];
  const r = await client.query(`SELECT token FROM fcm_tokens WHERE user_id = ANY($1::uuid[])`, [
    userIds,
  ]);
  return r.rows.map((x) => x.token);
}

/** ผู้ขายที่มีสินค้าในออเดอร์ (ไม่รวม buyer) */
/** @param {import('pg').PoolClient} client */
export async function listSellerIdsForOrder(client, orderId) {
  const r = await client.query(
    `SELECT DISTINCT p.seller_id
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1::uuid`,
    [orderId]
  );
  return r.rows.map((row) => row.seller_id).filter(Boolean);
}
