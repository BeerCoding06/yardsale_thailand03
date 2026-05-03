/**
 * Buyer wallet — กระเป๋าเงินผู้ซื้อ
 * ธุรกรรม: credit (refund) / debit (purchase)
 * Separate from seller_wallets / wallet_transactions
 */

/** สร้าง wallet ถ้ายังไม่มี */
export async function ensureBuyerWallet(client, userId) {
  await client.query(
    `INSERT INTO buyer_wallets (user_id) VALUES ($1::uuid)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

export async function getBuyerWallet(client, userId) {
  const r = await client.query(
    `SELECT user_id, balance, updated_at FROM buyer_wallets WHERE user_id = $1::uuid`,
    [userId]
  );
  return r.rows[0] || null;
}

/** SELECT ... FOR UPDATE — ใช้ภายใน transaction */
export async function lockBuyerWallet(client, userId) {
  await ensureBuyerWallet(client, userId);
  const r = await client.query(
    `SELECT user_id, balance, updated_at FROM buyer_wallets WHERE user_id = $1::uuid FOR UPDATE`,
    [userId]
  );
  return r.rows[0] || null;
}

export async function creditBuyerWallet(client, userId, amount) {
  const r = await client.query(
    `UPDATE buyer_wallets
     SET balance = balance + $2::numeric,
         updated_at = now()
     WHERE user_id = $1::uuid
     RETURNING user_id, balance, updated_at`,
    [userId, amount]
  );
  return r.rows[0] || null;
}

export async function debitBuyerWallet(client, userId, amount) {
  const r = await client.query(
    `UPDATE buyer_wallets
     SET balance = balance - $2::numeric,
         updated_at = now()
     WHERE user_id = $1::uuid
       AND balance >= $2::numeric
     RETURNING user_id, balance, updated_at`,
    [userId, amount]
  );
  return r.rows[0] || null;
}

/**
 * @param {object} row - { user_id, order_id?, type, source, amount, note?, expires_at? }
 */
export async function insertBuyerWalletTx(client, row) {
  const r = await client.query(
    `INSERT INTO buyer_wallet_transactions
      (user_id, order_id, type, source, amount, note, expires_at)
     VALUES ($1::uuid, $2::uuid, $3::buyer_wallet_tx_type, $4::buyer_wallet_tx_source,
             $5::numeric, $6, $7)
     RETURNING id, user_id, order_id, type::text, source::text, amount, note, expires_at, created_at`,
    [
      row.user_id,
      row.order_id || null,
      row.type,
      row.source,
      row.amount,
      row.note || null,
      row.expires_at || null,
    ]
  );
  return r.rows[0];
}

/** ตรวจสอบ refund ซ้ำ — คืน row ถ้าเคย credit refund สำหรับ order นี้แล้ว */
export async function findBuyerRefundTx(client, orderId, userId) {
  const r = await client.query(
    `SELECT id FROM buyer_wallet_transactions
     WHERE order_id = $1::uuid AND user_id = $2::uuid
       AND type = 'credit' AND source = 'refund'
     LIMIT 1`,
    [orderId, userId]
  );
  return r.rows[0] || null;
}

/** ประวัติธุรกรรมสำหรับผู้ใช้ */
export async function listBuyerWalletTxs(client, userId, { limit = 50, offset = 0 } = {}) {
  const r = await client.query(
    `SELECT id, user_id, order_id, type::text, source::text, amount, note, expires_at, created_at
     FROM buyer_wallet_transactions
     WHERE user_id = $1::uuid
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, Math.min(200, Math.max(1, limit)), Math.max(0, offset)]
  );
  return r.rows;
}

export async function countBuyerWalletTxs(client, userId) {
  const r = await client.query(
    `SELECT COUNT(*)::int AS n FROM buyer_wallet_transactions WHERE user_id = $1::uuid`,
    [userId]
  );
  return r.rows[0]?.n ?? 0;
}

/* ===== Refund records ===== */

export async function createRefundRecord(client, { orderId, userId, amount, reason, note }) {
  const r = await client.query(
    `INSERT INTO refunds (order_id, user_id, amount, reason, note)
     VALUES ($1::uuid, $2::uuid, $3::numeric, $4::refund_reason, $5)
     RETURNING id, order_id, user_id, amount, reason::text, status::text, note, created_at`,
    [orderId, userId, amount, reason, note || null]
  );
  return r.rows[0];
}

export async function updateRefundStatus(client, refundId, status, { note } = {}) {
  const r = await client.query(
    `UPDATE refunds
     SET status = $2::refund_status,
         processed_at = CASE WHEN $2 IN ('completed','failed','skipped') THEN now() ELSE processed_at END,
         note = COALESCE($3, note)
     WHERE id = $1::uuid
     RETURNING id, status::text, processed_at`,
    [refundId, status, note || null]
  );
  return r.rows[0] || null;
}

/** คืน refund record ล่าสุด (pending/completed) สำหรับ order */
export async function findRefundByOrderId(client, orderId) {
  const r = await client.query(
    `SELECT id, order_id, user_id, amount, reason::text, status::text, note, processed_at, created_at
     FROM refunds
     WHERE order_id = $1::uuid
       AND status IN ('pending', 'completed')
     ORDER BY created_at DESC
     LIMIT 1`,
    [orderId]
  );
  return r.rows[0] || null;
}

/* ===== orders: paid_at, wallet_amount_used, refund_processed_at ===== */

/** บันทึก paid_at เมื่อออเดอร์ชำระแล้ว (idempotent) */
export async function setPaidAt(client, orderId) {
  await client.query(
    `UPDATE orders SET paid_at = COALESCE(paid_at, now()) WHERE id = $1::uuid`,
    [orderId]
  );
}

export async function setRefundProcessedAt(client, orderId) {
  await client.query(
    `UPDATE orders SET refund_processed_at = now() WHERE id = $1::uuid AND refund_processed_at IS NULL`,
    [orderId]
  );
}

/** ออเดอร์ที่ชำระแล้วแต่ไม่จัดส่งเกิน N วัน และยังไม่มี refund */
export async function findOrdersPaidNotShipped(client, daysThreshold = 3) {
  const r = await client.query(
    `SELECT o.id, o.user_id, o.total_price, o.wallet_amount_used,
            o.paid_at, o.shipping_status, o.refund_processed_at
     FROM orders o
     WHERE o.status = 'paid'
       AND o.paid_at IS NOT NULL
       AND o.paid_at < now() - ($1 || ' days')::interval
       AND o.refund_processed_at IS NULL
       AND COALESCE(o.shipping_status, 'pending') IN ('pending', 'preparing')
     ORDER BY o.paid_at ASC`,
    [String(daysThreshold)]
  );
  return r.rows;
}

/* ===== Admin ===== */

export async function listAllBuyerWalletTxsAdmin(
  client,
  { limit = 50, offset = 0, user_id: userId = '', date_from: dateFrom = '', date_to: dateTo = '' } = {}
) {
  const lim = Math.min(200, Math.max(1, Number(limit) || 50));
  const off = Math.max(0, Number(offset) || 0);
  const parts = ['WHERE 1=1'];
  const params = [];
  let i = 1;
  if (userId) { parts.push(`AND bwt.user_id = $${i++}::uuid`); params.push(userId); }
  if (dateFrom) { parts.push(`AND bwt.created_at >= $${i++}::date`); params.push(dateFrom); }
  if (dateTo) { parts.push(`AND bwt.created_at < ($${i++}::date + interval '1 day')`); params.push(dateTo); }
  params.push(lim, off);
  const iLim = params.length - 1;
  const iOff = params.length;
  const where = parts.join(' ');
  const r = await client.query(
    `SELECT bwt.id, bwt.user_id, bwt.order_id, bwt.type::text, bwt.source::text,
            bwt.amount, bwt.note, bwt.expires_at, bwt.created_at,
            u.email AS user_email, u.name AS user_name
     FROM buyer_wallet_transactions bwt
     JOIN users u ON u.id = bwt.user_id
     ${where}
     ORDER BY bwt.created_at DESC
     LIMIT $${iLim} OFFSET $${iOff}`,
    params
  );
  return r.rows;
}

export async function countAllBuyerWalletTxsAdmin(
  client,
  { user_id: userId = '', date_from: dateFrom = '', date_to: dateTo = '' } = {}
) {
  const parts = ['WHERE 1=1'];
  const params = [];
  let i = 1;
  if (userId) { parts.push(`AND bwt.user_id = $${i++}::uuid`); params.push(userId); }
  if (dateFrom) { parts.push(`AND bwt.created_at >= $${i++}::date`); params.push(dateFrom); }
  if (dateTo) { parts.push(`AND bwt.created_at < ($${i++}::date + interval '1 day')`); params.push(dateTo); }
  const r = await client.query(
    `SELECT COUNT(*)::int AS n FROM buyer_wallet_transactions bwt ${parts.join(' ')}`,
    params
  );
  return r.rows[0]?.n ?? 0;
}

export async function aggregateBuyerWallets(client) {
  const r = await client.query(
    `SELECT COUNT(*)::int AS total_wallets,
            COALESCE(SUM(balance), 0)::numeric(14,2) AS total_balance
     FROM buyer_wallets`
  );
  return r.rows[0] || { total_wallets: 0, total_balance: 0 };
}

/* ===== Refund Requests (user-initiated, needs admin review) ===== */

export async function createRefundRequest(client, { orderId, userId, reason, note, evidencePaths, productItems }) {
  const paths = Array.isArray(evidencePaths) ? evidencePaths : [];
  const pathsJson = JSON.stringify(paths);
  const items = Array.isArray(productItems) ? productItems : [];
  const itemsJson = JSON.stringify(items);
  const r = await client.query(
    `INSERT INTO refund_requests (order_id, user_id, reason, note, evidence_paths, product_items)
     VALUES ($1::uuid, $2::uuid, $3::refund_reason, $4, $5::jsonb, $6::jsonb)
     RETURNING id, order_id, user_id, reason::text, status::text, note,
               evidence_paths, COALESCE(product_items, '[]'::jsonb) AS product_items, created_at`,
    [orderId, userId, reason, note || null, pathsJson, itemsJson]
  );
  return r.rows[0];
}

export async function findRefundRequestByOrderId(client, orderId) {
  const r = await client.query(
    `SELECT id, order_id, user_id, reason::text, note, status::text,
            COALESCE(evidence_paths, '[]'::jsonb) AS evidence_paths, COALESCE(product_items, '[]'::jsonb) AS product_items, rejection_reason, admin_id, admin_note, reviewed_at, refund_id, created_at
     FROM refund_requests WHERE order_id = $1::uuid LIMIT 1`,
    [orderId]
  );
  return r.rows[0] || null;
}

export async function listRefundRequestsForUser(client, userId, { limit = 20, offset = 0 } = {}) {
  const r = await client.query(
    `SELECT rr.id, rr.order_id, rr.user_id, rr.reason::text, rr.note,
            COALESCE(rr.evidence_paths, '[]'::jsonb) AS evidence_paths, COALESCE(rr.product_items, '[]'::jsonb) AS product_items, rr.rejection_reason, rr.status::text, rr.admin_note, rr.reviewed_at, rr.refund_id,
            rr.created_at,
            o.total_price AS order_amount, o.status::text AS order_status
     FROM refund_requests rr
     JOIN orders o ON o.id = rr.order_id
     WHERE rr.user_id = $1::uuid
     ORDER BY rr.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, Math.min(100, Math.max(1, limit)), Math.max(0, offset)]
  );
  return r.rows;
}

export async function updateRefundRequest(client, requestId, {
  status,
  adminId,
  adminNote,
  refundId,
  rejectionReason,
}) {
  const r = await client.query(
    `UPDATE refund_requests
     SET status     = $2::refund_request_status,
         admin_id   = COALESCE($3::uuid, admin_id),
         admin_note = COALESCE($4, admin_note),
         refund_id  = COALESCE($5::uuid, refund_id),
         rejection_reason = COALESCE($6, rejection_reason),
         reviewed_at = CASE WHEN $2 IN ('approved','rejected') THEN now() ELSE reviewed_at END
     WHERE id = $1::uuid
     RETURNING id, status::text, reviewed_at, admin_note, refund_id`,
    [requestId, status, adminId || null, adminNote || null, refundId || null, rejectionReason || null]
  );
  return r.rows[0] || null;
}

export async function lockRefundRequestById(client, requestId) {
  const r = await client.query(
    `SELECT rr.*, o.user_id AS order_user_id, o.total_price AS order_amount,
            o.status::text AS order_status
     FROM refund_requests rr
     JOIN orders o ON o.id = rr.order_id
     WHERE rr.id = $1::uuid FOR UPDATE`,
    [requestId]
  );
  return r.rows[0] || null;
}

/** Admin: รายการคำขอคืนเงินทั้งหมด */
export async function listRefundRequestsAdmin(
  client,
  { limit = 50, offset = 0, status = '', date_from: dateFrom = '', date_to: dateTo = '' } = {}
) {
  const lim = Math.min(200, Math.max(1, Number(limit) || 50));
  const off = Math.max(0, Number(offset) || 0);
  const parts = ['WHERE 1=1'];
  const params = [];
  let i = 1;
  if (status) { parts.push(`AND rr.status = $${i++}::refund_request_status`); params.push(status); }
  if (dateFrom) { parts.push(`AND rr.created_at >= $${i++}::date`); params.push(dateFrom); }
  if (dateTo) { parts.push(`AND rr.created_at < ($${i++}::date + interval '1 day')`); params.push(dateTo); }
  params.push(lim, off);
  const iLim = params.length - 1;
  const iOff = params.length;
  const r = await client.query(
    `SELECT rr.id, rr.order_id, rr.user_id, rr.reason::text, rr.note,
            COALESCE(rr.evidence_paths, '[]'::jsonb) AS evidence_paths, COALESCE(rr.product_items, '[]'::jsonb) AS product_items, rr.rejection_reason, rr.status::text, rr.admin_note, rr.reviewed_at, rr.refund_id, rr.created_at,
            u.email AS user_email, u.name AS user_name,
            o.total_price AS order_amount, o.status::text AS order_status
     FROM refund_requests rr
     JOIN users u ON u.id = rr.user_id
     JOIN orders o ON o.id = rr.order_id
     ${parts.join(' ')}
     ORDER BY rr.created_at DESC
     LIMIT $${iLim} OFFSET $${iOff}`,
    params
  );
  return r.rows;
}

export async function countRefundRequestsAdmin(client, { status = '' } = {}) {
  const parts = ['WHERE 1=1'];
  const params = [];
  let i = 1;
  if (status) { parts.push(`AND rr.status = $${i++}::refund_request_status`); params.push(status); }
  const r = await client.query(
    `SELECT COUNT(*)::int AS n FROM refund_requests rr ${parts.join(' ')}`,
    params
  );
  return r.rows[0]?.n ?? 0;
}

/* ===== Eligible orders for refund request ===== */

/** ออเดอร์ที่ชำระแล้ว ยังไม่มีคำขอคืนเงิน และยังไม่ถูกคืนเงินไปแล้ว */
export async function listEligibleOrdersForRefundRequest(client, userId) {
  const r = await client.query(
    `SELECT o.id, o.total_price, o.status::text, o.created_at,
            o.shipping_status, o.paid_at, o.refund_processed_at
     FROM orders o
     WHERE o.user_id = $1::uuid
       AND o.status = 'paid'
       AND o.refund_processed_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM refund_requests rr WHERE rr.order_id = o.id
       )
     ORDER BY o.created_at DESC
     LIMIT 20`,
    [userId]
  );
  return r.rows;
}

export async function listRefundsAdmin(
  client,
  { limit = 50, offset = 0, status = '', date_from: dateFrom = '', date_to: dateTo = '' } = {}
) {
  const lim = Math.min(200, Math.max(1, Number(limit) || 50));
  const off = Math.max(0, Number(offset) || 0);
  const parts = ['WHERE 1=1'];
  const params = [];
  let i = 1;
  if (status) { parts.push(`AND r.status = $${i++}::refund_status`); params.push(status); }
  if (dateFrom) { parts.push(`AND r.created_at >= $${i++}::date`); params.push(dateFrom); }
  if (dateTo) { parts.push(`AND r.created_at < ($${i++}::date + interval '1 day')`); params.push(dateTo); }
  params.push(lim, off);
  const iLim = params.length - 1;
  const iOff = params.length;
  const where = parts.join(' ');
  const r = await client.query(
    `SELECT r.id, r.order_id, r.user_id, r.amount, r.reason::text, r.status::text,
            r.note, r.processed_at, r.created_at,
            u.email AS user_email, u.name AS user_name
     FROM refunds r
     JOIN users u ON u.id = r.user_id
     ${where}
     ORDER BY r.created_at DESC
     LIMIT $${iLim} OFFSET $${iOff}`,
    params
  );
  return r.rows;
}
