import { ilikeContainsPattern } from '../utils/pagination.js';

export async function findUserByEmail(client, email) {
  const r = await client.query(
    `SELECT id, email, password_hash, name, role, account_status, created_at
     FROM users WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  return r.rows[0] || null;
}

export async function findUserById(client, id) {
  const r = await client.query(
    `SELECT id, email, name, role, account_status, created_at FROM users WHERE id = $1`,
    [id]
  );
  return r.rows[0] || null;
}

export async function getUserAccountStatus(client, id) {
  const r = await client.query(`SELECT account_status FROM users WHERE id = $1`, [id]);
  return r.rows[0]?.account_status ?? null;
}

export async function createUser(client, { email, passwordHash, name, role, accountStatus = 'public' }) {
  const r = await client.query(
    `INSERT INTO users (email, password_hash, name, role, account_status)
     VALUES ($1, $2, $3, $4::user_role, $5::user_account_status)
     RETURNING id, email, name, role, account_status, created_at`,
    [email, passwordHash, name, role, accountStatus]
  );
  return r.rows[0];
}

export async function emailExists(client, email, excludeUserId = null) {
  const r = excludeUserId
    ? await client.query(
        `SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2::uuid LIMIT 1`,
        [email, excludeUserId]
      )
    : await client.query(`SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [email]);
  return r.rowCount > 0;
}

export async function countUsers(client, { search } = {}) {
  const like = ilikeContainsPattern(search);
  const params = [];
  let where = '';
  if (like) {
    params.push(like);
    where = ` WHERE (
      LOWER(email) ILIKE $1 ESCAPE '\\'
      OR LOWER(COALESCE(name,'')) ILIKE $1 ESCAPE '\\'
      OR CAST(id AS TEXT) ILIKE $1 ESCAPE '\\'
    )`;
  }
  const r = await client.query(`SELECT COUNT(*)::int AS c FROM users ${where}`, params);
  return r.rows[0]?.c ?? 0;
}

export async function listUsers(client, { limit = 100, offset = 0, search } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const off = Math.max(Number(offset) || 0, 0);
  const like = ilikeContainsPattern(search);
  const params = [];
  let where = '';
  if (like) {
    params.push(like);
    where = ` WHERE (
      LOWER(email) ILIKE $1 ESCAPE '\\'
      OR LOWER(COALESCE(name,'')) ILIKE $1 ESCAPE '\\'
      OR CAST(id AS TEXT) ILIKE $1 ESCAPE '\\'
    )`;
  }
  params.push(lim, off);
  const iLim = params.length - 1;
  const iOff = params.length;
  const r = await client.query(
    `SELECT id, email, name, role, account_status, created_at
     FROM users
     ${where}
     ORDER BY created_at DESC
     LIMIT $${iLim} OFFSET $${iOff}`,
    params
  );
  return r.rows;
}

export async function updateUserById(client, id, { email, name, role, accountStatus, passwordHash }) {
  const sets = [];
  const values = [];
  let i = 1;
  if (email !== undefined) {
    sets.push(`email = $${i++}`);
    values.push(email);
  }
  if (name !== undefined) {
    sets.push(`name = $${i++}`);
    values.push(name);
  }
  if (role !== undefined) {
    sets.push(`role = $${i++}::user_role`);
    values.push(role);
  }
  if (accountStatus !== undefined) {
    sets.push(`account_status = $${i++}::user_account_status`);
    values.push(accountStatus);
  }
  if (passwordHash !== undefined) {
    sets.push(`password_hash = $${i++}`);
    values.push(passwordHash);
  }
  if (!sets.length) return null;
  values.push(id);
  const r = await client.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${i}::uuid
     RETURNING id, email, name, role, account_status, created_at`,
    values
  );
  return r.rows[0] || null;
}

export async function deleteUserById(client, id) {
  const r = await client.query(`DELETE FROM users WHERE id = $1::uuid RETURNING id`, [id]);
  return r.rowCount > 0;
}

export async function countAdmins(client) {
  const r = await client.query(`SELECT COUNT(*)::int AS c FROM users WHERE role = 'admin'`);
  return r.rows[0]?.c ?? 0;
}

export async function countOrdersForUser(client, userId) {
  const r = await client.query(`SELECT COUNT(*)::int AS c FROM orders WHERE user_id = $1::uuid`, [userId]);
  return r.rows[0]?.c ?? 0;
}

export async function countProductsForSeller(client, sellerId) {
  const r = await client.query(`SELECT COUNT(*)::int AS c FROM products WHERE seller_id = $1::uuid`, [
    sellerId,
  ]);
  return r.rows[0]?.c ?? 0;
}
