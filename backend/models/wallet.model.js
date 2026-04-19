/**
 * Seller wallets, ledger transactions, financial audit trail.
 */

export async function ensureSellerWallet(client, sellerId) {
  await client.query(
    `INSERT INTO seller_wallets (seller_id) VALUES ($1::uuid)
     ON CONFLICT (seller_id) DO NOTHING`,
    [sellerId]
  );
}

export async function getSellerWallet(client, sellerId) {
  const r = await client.query(
    `SELECT seller_id, available_balance, escrow_balance, updated_at
     FROM seller_wallets WHERE seller_id = $1::uuid`,
    [sellerId]
  );
  return r.rows[0] || null;
}

export async function lockSellerWallet(client, sellerId) {
  await ensureSellerWallet(client, sellerId);
  const r = await client.query(
    `SELECT seller_id, available_balance, escrow_balance, updated_at
     FROM seller_wallets WHERE seller_id = $1::uuid FOR UPDATE`,
    [sellerId]
  );
  return r.rows[0] || null;
}

export async function addEscrow(client, sellerId, amount) {
  const r = await client.query(
    `UPDATE seller_wallets
     SET escrow_balance = escrow_balance + $2::numeric,
         updated_at = now()
     WHERE seller_id = $1::uuid
     RETURNING seller_id, available_balance, escrow_balance, updated_at`,
    [sellerId, amount]
  );
  return r.rows[0] || null;
}

export async function moveEscrowToAvailable(client, sellerId, amount) {
  const r = await client.query(
    `UPDATE seller_wallets
     SET escrow_balance = escrow_balance - $2::numeric,
         available_balance = available_balance + $2::numeric,
         updated_at = now()
     WHERE seller_id = $1::uuid
       AND escrow_balance >= $2::numeric
     RETURNING seller_id, available_balance, escrow_balance, updated_at`,
    [sellerId, amount]
  );
  return r.rows[0] || null;
}

export async function deductAvailable(client, sellerId, amount) {
  const r = await client.query(
    `UPDATE seller_wallets
     SET available_balance = available_balance - $2::numeric,
         updated_at = now()
     WHERE seller_id = $1::uuid
       AND available_balance >= $2::numeric
     RETURNING seller_id, available_balance, escrow_balance, updated_at`,
    [sellerId, amount]
  );
  return r.rows[0] || null;
}

export async function creditAvailable(client, sellerId, amount) {
  const r = await client.query(
    `UPDATE seller_wallets
     SET available_balance = available_balance + $2::numeric,
         updated_at = now()
     WHERE seller_id = $1::uuid
     RETURNING seller_id, available_balance, escrow_balance, updated_at`,
    [sellerId, amount]
  );
  return r.rows[0] || null;
}

export async function insertWalletTransaction(client, row) {
  const r = await client.query(
    `INSERT INTO wallet_transactions
      (seller_id, order_id, withdrawal_id, type, amount, status, metadata)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::wallet_tx_type, $5::numeric, $6::wallet_tx_status, $7::jsonb)
     RETURNING id, seller_id, order_id, withdrawal_id, type, amount, status, metadata, created_at`,
    [
      row.seller_id,
      row.order_id || null,
      row.withdrawal_id || null,
      row.type,
      row.amount,
      row.status || 'completed',
      row.metadata ? JSON.stringify(row.metadata) : null,
    ]
  );
  return r.rows[0];
}

export async function findEscrowTransaction(client, orderId, sellerId) {
  const r = await client.query(
    `SELECT id FROM wallet_transactions
     WHERE order_id = $1::uuid AND seller_id = $2::uuid AND type = 'escrow_in'
     LIMIT 1`,
    [orderId, sellerId]
  );
  return r.rows[0] || null;
}

export async function findReleaseTransaction(client, orderId, sellerId) {
  const r = await client.query(
    `SELECT id FROM wallet_transactions
     WHERE order_id = $1::uuid AND seller_id = $2::uuid AND type = 'release'
     LIMIT 1`,
    [orderId, sellerId]
  );
  return r.rows[0] || null;
}

export async function countReleaseTransactionsForOrder(client, orderId) {
  const r = await client.query(
    `SELECT COUNT(*)::int AS n FROM wallet_transactions
     WHERE order_id = $1::uuid AND type = 'release'`,
    [orderId]
  );
  return r.rows[0]?.n ?? 0;
}

export async function listWalletTransactionsForSeller(client, sellerId, { limit = 50, offset = 0 } = {}) {
  const r = await client.query(
    `SELECT id, seller_id, order_id, withdrawal_id, type, amount, status, metadata, created_at
     FROM wallet_transactions
     WHERE seller_id = $1::uuid
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [sellerId, Math.min(200, Math.max(1, limit)), Math.max(0, offset)]
  );
  return r.rows;
}

export async function insertFinancialAudit(client, { actorUserId, action, entityType, entityId, details }) {
  await client.query(
    `INSERT INTO financial_audit_logs (actor_user_id, action, entity_type, entity_id, details)
     VALUES ($1::uuid, $2, $3, $4::uuid, $5::jsonb)`,
    [
      actorUserId || null,
      action,
      entityType,
      entityId || null,
      details ? JSON.stringify(details) : null,
    ]
  );
}

export async function countWithdrawalsByStatus(client) {
  const r = await client.query(
    `SELECT status::text AS status, COUNT(*)::int AS n, COALESCE(SUM(amount),0)::numeric(14,2) AS total_amount
     FROM withdrawals GROUP BY status`
  );
  const by = {};
  for (const row of r.rows) {
    by[row.status] = { count: row.n, total_amount: Number(row.total_amount) };
  }
  return by;
}

export async function listWithdrawalsAdmin(client, { status, limit = 50, offset = 0 }) {
  const lim = Math.min(200, Math.max(1, limit));
  const off = Math.max(0, offset);
  if (status && String(status).trim()) {
    const r = await client.query(
      `SELECT w.*, u.email AS seller_email, u.name AS seller_name
       FROM withdrawals w
       JOIN users u ON u.id = w.seller_id
       WHERE w.status = $1::withdrawal_status
       ORDER BY w.requested_at DESC
       LIMIT $2 OFFSET $3`,
      [String(status).trim(), lim, off]
    );
    return r.rows;
  }
  const r = await client.query(
    `SELECT w.*, u.email AS seller_email, u.name AS seller_name
     FROM withdrawals w
     JOIN users u ON u.id = w.seller_id
     ORDER BY w.requested_at DESC
     LIMIT $1 OFFSET $2`,
    [lim, off]
  );
  return r.rows;
}

export async function countWithdrawalsAdmin(client, { status }) {
  if (status && String(status).trim()) {
    const r = await client.query(
      `SELECT COUNT(*)::int AS n FROM withdrawals WHERE status = $1::withdrawal_status`,
      [String(status).trim()]
    );
    return r.rows[0]?.n ?? 0;
  }
  const r = await client.query(`SELECT COUNT(*)::int AS n FROM withdrawals`);
  return r.rows[0]?.n ?? 0;
}

function buildLedgerFilter(type, sellerId) {
  const parts = ['WHERE 1=1'];
  const params = [];
  let i = 1;
  if (type && String(type).trim()) {
    parts.push(`AND wt.type = $${i++}::wallet_tx_type`);
    params.push(String(type).trim());
  }
  if (sellerId && String(sellerId).trim()) {
    parts.push(`AND wt.seller_id = $${i++}::uuid`);
    params.push(String(sellerId).trim());
  }
  return { sql: parts.join(' '), params };
}

/** รายการ ledger ทั้งแพลตฟอร์ม — CMS: ผู้ขาย + ออเดอร์ (ผู้ซื้อ) สำหรับบริบทการซื้อขาย */
export async function listWalletTransactionsAdmin(
  client,
  { limit = 50, offset = 0, type = '', seller_id: sellerId = '' } = {}
) {
  const lim = Math.min(200, Math.max(1, Number(limit) || 50));
  const off = Math.max(0, Number(offset) || 0);
  const { sql: whereSql, params: fp } = buildLedgerFilter(type, sellerId);
  const params = [...fp, lim, off];
  const iLim = params.length - 1;
  const iOff = params.length;
  const sqlWithOrderContext = `SELECT wt.id, wt.seller_id, wt.order_id, wt.withdrawal_id, wt.type::text AS type,
            wt.amount, wt.status::text AS status, wt.metadata, wt.created_at,
            u.email AS seller_email, u.name AS seller_name,
            o.user_id AS buyer_user_id, bu.email AS buyer_email, bu.name AS buyer_name,
            o.total_price AS order_total, o.status::text AS order_status
     FROM wallet_transactions wt
     JOIN users u ON u.id = wt.seller_id
     LEFT JOIN orders o ON o.id = wt.order_id
     LEFT JOIN users bu ON bu.id = o.user_id
     ${whereSql}
     ORDER BY wt.created_at DESC
     LIMIT $${iLim} OFFSET $${iOff}`;
  try {
    const r = await client.query(sqlWithOrderContext, params);
    return r.rows;
  } catch (err) {
    if (err?.code !== '42703') throw err;
    const r2 = await client.query(
      `SELECT wt.id, wt.seller_id, wt.order_id, wt.withdrawal_id, wt.type::text AS type,
              wt.amount, wt.status::text AS status, wt.metadata, wt.created_at,
              u.email AS seller_email, u.name AS seller_name,
              NULL::uuid AS buyer_user_id, NULL::text AS buyer_email, NULL::text AS buyer_name,
              NULL::numeric AS order_total, NULL::text AS order_status
       FROM wallet_transactions wt
       JOIN users u ON u.id = wt.seller_id
       ${whereSql}
       ORDER BY wt.created_at DESC
       LIMIT $${iLim} OFFSET $${iOff}`,
      params
    );
    return r2.rows;
  }
}

export async function countWalletTransactionsAdmin(client, { type = '', seller_id: sellerId = '' } = {}) {
  const { sql: whereSql, params } = buildLedgerFilter(type, sellerId);
  const r = await client.query(
    `SELECT COUNT(*)::int AS n FROM wallet_transactions wt ${whereSql}`,
    params
  );
  return r.rows[0]?.n ?? 0;
}

export async function listWalletTransactionsForWithdrawal(client, withdrawalId) {
  const r = await client.query(
    `SELECT id, seller_id, order_id, withdrawal_id, type::text AS type, amount,
            status::text AS status, metadata, created_at
     FROM wallet_transactions
     WHERE withdrawal_id = $1::uuid
     ORDER BY created_at ASC`,
    [withdrawalId]
  );
  return r.rows;
}

/** บันทึก audit ทางการเงิน — CMS */
export async function listFinancialAuditLogsAdmin(
  client,
  { limit = 50, offset = 0, action = '', entity_type: entityType = '' } = {}
) {
  const lim = Math.min(200, Math.max(1, Number(limit) || 50));
  const off = Math.max(0, Number(offset) || 0);
  const parts = ['WHERE 1=1'];
  const params = [];
  let i = 1;
  if (action && String(action).trim()) {
    parts.push(`AND f.action = $${i++}`);
    params.push(String(action).trim());
  }
  if (entityType && String(entityType).trim()) {
    parts.push(`AND f.entity_type = $${i++}`);
    params.push(String(entityType).trim());
  }
  params.push(lim, off);
  const iLim = params.length - 1;
  const iOff = params.length;
  const whereClause = parts.join(' ');
  const sqlWithActor = `SELECT f.id, f.actor_user_id, f.action, f.entity_type, f.entity_id, f.details, f.created_at,
            au.email AS actor_email, au.name AS actor_name
     FROM financial_audit_logs f
     LEFT JOIN users au ON au.id = f.actor_user_id
     ${whereClause}
     ORDER BY f.created_at DESC
     LIMIT $${iLim} OFFSET $${iOff}`;
  try {
    const r = await client.query(sqlWithActor, params);
    return r.rows;
  } catch (err) {
    if (err?.code !== '42703') throw err;
    const r2 = await client.query(
      `SELECT f.id, f.actor_user_id, f.action, f.entity_type, f.entity_id, f.details, f.created_at,
              NULL::text AS actor_email, NULL::text AS actor_name
       FROM financial_audit_logs f
       ${whereClause}
       ORDER BY f.created_at DESC
       LIMIT $${iLim} OFFSET $${iOff}`,
      params
    );
    return r2.rows;
  }
}

export async function countFinancialAuditLogsAdmin(client, { action = '', entity_type: entityType = '' } = {}) {
  const parts = ['WHERE 1=1'];
  const params = [];
  let i = 1;
  if (action && String(action).trim()) {
    parts.push(`AND f.action = $${i++}`);
    params.push(String(action).trim());
  }
  if (entityType && String(entityType).trim()) {
    parts.push(`AND f.entity_type = $${i++}`);
    params.push(String(entityType).trim());
  }
  const r = await client.query(
    `SELECT COUNT(*)::int AS n FROM financial_audit_logs f ${parts.join(' ')}`,
    params
  );
  return r.rows[0]?.n ?? 0;
}
