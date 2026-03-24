import { pool } from '../models/db.js';

export async function listCategories() {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT id, name, slug, created_at FROM categories ORDER BY name`
    );
    return r.rows;
  } finally {
    client.release();
  }
}
