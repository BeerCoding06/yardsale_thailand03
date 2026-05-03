/**
 * ถ้ามีตาราง refund_requests แต่ยังไม่มีคอลัมน์เสริม — รัน migration ครั้งเดียวต่อคอลัมน์
 * (production ที่มี buyer_wallets อยู่แล้วจะไม่รัน wallet migrations ทั้งชุด)
 *
 * คอลัมน์: evidence_paths (20260503), product_items (20260504)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../models/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function tableRefundRequestsExists(client) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'refund_requests' LIMIT 1`
  );
  return r.rows.length > 0;
}

async function columnExists(client, columnName) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'refund_requests'
       AND column_name = $1 LIMIT 1`,
    [columnName]
  );
  return r.rows.length > 0;
}

export async function ensureRefundRequestEvidenceColumnOnStartup() {
  const client = await pool.connect();
  try {
    if (!(await tableRefundRequestsExists(client))) return;

    if (!(await columnExists(client, 'evidence_paths'))) {
      const sqlPath = path.join(__dirname, '../db/migrations/20260503_refund_request_evidence.sql');
      const sql = fs.readFileSync(sqlPath, 'utf8');
      console.warn('[refund-requests] evidence_paths missing — applying', path.basename(sqlPath));
      await client.query(sql);
      console.info('[refund-requests] evidence_paths migration OK');
    }

    if (!(await columnExists(client, 'product_items'))) {
      const sqlPath = path.join(__dirname, '../db/migrations/20260504_refund_request_products.sql');
      const sql = fs.readFileSync(sqlPath, 'utf8');
      console.warn('[refund-requests] product_items missing — applying', path.basename(sqlPath));
      await client.query(sql);
      console.info('[refund-requests] product_items migration OK');
    }
  } catch (e) {
    console.error('[refund-requests] column migration failed:', e?.code, e?.message);
    if (e?.stack) console.error(e.stack);
  } finally {
    client.release();
  }
}
