export async function findUserByEmail(client, email) {
  const r = await client.query(
    `SELECT id, email, password_hash, name, role, created_at FROM users WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  return r.rows[0] || null;
}

export async function findUserById(client, id) {
  const r = await client.query(
    `SELECT id, email, name, role, created_at FROM users WHERE id = $1`,
    [id]
  );
  return r.rows[0] || null;
}

export async function createUser(client, { email, passwordHash, name, role }) {
  const r = await client.query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4::user_role)
     RETURNING id, email, name, role, created_at`,
    [email, passwordHash, name, role]
  );
  return r.rows[0];
}

export async function emailExists(client, email) {
  const r = await client.query(`SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [email]);
  return r.rowCount > 0;
}

export async function listUsers(client, { limit = 100, offset = 0 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const off = Math.max(Number(offset) || 0, 0);
  const r = await client.query(
    `SELECT id, email, name, role, created_at
     FROM users
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [lim, off]
  );
  return r.rows;
}
