import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;

const connectionString =
  config.databaseUrl || 'postgresql://127.0.0.1:5432/yardsale';

if (!config.databaseUrl) {
  console.warn('[db] DATABASE_URL not set — using default', connectionString);
}

export const pool = new Pool({ connectionString });

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
