/**
 * ถ้ามีตาราง refund_requests แต่ยังไม่มีคอลัมน์ evidence_paths — รัน migration ครั้งเดียว
 * (กรณี production ที่มี buyer_wallets อยู่แล้ว — bootstrap เดิมจะไม่รัน wallet migrations ทั้งชุด)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../models/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function ensureRefundRequestEvidenceColumnOnStartup() {
  const client = await pool.connect();
  try {
    const tbl = await client.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'refund_requests' LIMIT 1`
    );
    if (tbl.rows.length === 0) return;

    const col = await client.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'refund_requests'
         AND column_name = 'evidence_paths' LIMIT 1`
    );
    if (col.rows.length > 0) return;

    const sqlPath = path.join(__dirname, '../db/migrations/20260503_refund_request_evidence.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.warn('[refund-requests] evidence_paths missing — applying', path.basename(sqlPath));
    await client.query(sql);
    console.info('[refund-requests] evidence column migration applied OK');
  } catch (e) {
    console.error('[refund-requests] evidence column migration failed:', e?.code, e?.message);
    if (e?.stack) console.error(e.stack);
  } finally {
    client.release();
  }
}
