/**
 * รัน migration wallet ตอนสตาร์ทเซิร์ฟเวอร์ — ใช้เมื่อ Dokploy/Docker ยังไม่รัน SQL แยก
 * เปิด: AUTO_MIGRATE_WALLET_ON_START=1 (หรือ true/yes)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../models/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function autoMigrateEnabled() {
  const v = String(process.env.AUTO_MIGRATE_WALLET_ON_START || '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export async function ensureWalletSchemaOnStartup() {
  if (!autoMigrateEnabled()) return;

  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT
        to_regclass('public.seller_wallets') AS sw,
        to_regclass('public.wallet_transactions') AS wt,
        to_regclass('public.withdrawals') AS wd
    `);
    const r = rows[0];
    if (r?.sw && r?.wt && r?.wd) {
      console.info('[wallet] wallet tables present — skip AUTO_MIGRATE_WALLET_ON_START');
      return;
    }
    const sqlPath = path.join(__dirname, '../db/migrations/20260417_seller_wallet_system.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.warn('[wallet] applying', path.basename(sqlPath), '(AUTO_MIGRATE_WALLET_ON_START)');
    await client.query(sql);
    console.info('[wallet] migration applied OK');
  } catch (e) {
    console.error('[wallet] AUTO_MIGRATE_WALLET_ON_START failed:', e?.code, e?.message);
  } finally {
    client.release();
  }
}
