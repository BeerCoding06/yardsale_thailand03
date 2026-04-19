export async function createWithdrawal(
  client,
  {
    sellerId,
    amount,
    payoutBankCode,
    payoutAccountName,
    payoutAccountNumber,
    withdrawalFeeAmount,
    netPayoutAmount,
  }
) {
  const r = await client.query(
    `INSERT INTO withdrawals (
       seller_id, amount, status,
       payout_bank_code, payout_account_name, payout_account_number,
       withdrawal_fee_amount, net_payout_amount
     )
     VALUES ($1::uuid, $2::numeric, 'pending', $3, $4, $5, $6::numeric, $7::numeric)
     RETURNING *`,
    [
      sellerId,
      amount,
      payoutBankCode,
      payoutAccountName,
      payoutAccountNumber,
      withdrawalFeeAmount,
      netPayoutAmount,
    ]
  );
  return r.rows[0];
}

export async function getWithdrawalById(client, id) {
  const r = await client.query(`SELECT * FROM withdrawals WHERE id = $1::uuid`, [id]);
  return r.rows[0] || null;
}

export async function lockWithdrawalById(client, id) {
  const r = await client.query(
    `SELECT * FROM withdrawals WHERE id = $1::uuid FOR UPDATE`,
    [id]
  );
  return r.rows[0] || null;
}

export async function updateWithdrawal(
  client,
  id,
  { status, adminNotes, processedAt } = {}
) {
  const sets = [];
  const params = [];
  let i = 1;
  if (status != null) {
    sets.push(`status = $${i++}::withdrawal_status`);
    params.push(status);
  }
  if (adminNotes !== undefined) {
    sets.push(`admin_notes = $${i++}`);
    params.push(adminNotes);
  }
  if (processedAt !== undefined) {
    sets.push(`processed_at = $${i++}`);
    params.push(processedAt);
  }
  if (!sets.length) {
    return getWithdrawalById(client, id);
  }
  params.push(id);
  const r = await client.query(
    `UPDATE withdrawals SET ${sets.join(', ')} WHERE id = $${i}::uuid RETURNING *`,
    params
  );
  return r.rows[0] || null;
}

export async function listWithdrawalsForSeller(client, sellerId, { limit = 50, offset = 0 } = {}) {
  const r = await client.query(
    `SELECT * FROM withdrawals
     WHERE seller_id = $1::uuid
     ORDER BY requested_at DESC
     LIMIT $2 OFFSET $3`,
    [sellerId, Math.min(200, Math.max(1, limit)), Math.max(0, offset)]
  );
  return r.rows;
}
