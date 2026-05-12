/**
 * เพิ่มคอลัมน์ delivered_at / auto_confirmed_at บน orders ถ้ายังไม่มี (escrow 48 ชม.)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../models/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function ensureEscrowDeliveryColumnsOnStartup() {
  const client = await pool.connect();
  try {
    const c1 = await client.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'delivered_at' LIMIT 1`
    );
    const c2 = await client.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'auto_confirmed_at' LIMIT 1`
    );
    if (c1.rows.length && c2.rows.length) return;

    const sqlPath = path.join(__dirname, '../db/migrations/20260512_escrow_delivered_at.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.warn('[escrow] orders.delivered_at / auto_confirmed_at — applying', path.basename(sqlPath));
    await client.query(sql);
    console.info('[escrow] delivery timestamp migration OK');
  } catch (e) {
    console.error('[escrow] delivery column migration failed:', e?.code, e?.message);
    if (e?.stack) console.error(e.stack);
  } finally {
    client.release();
  }
}
