/**
 * ถ้ายังไม่มีตาราง buyer_wallets — รัน wallet migrations ครั้งเดียวตอนสตาร์ท
 * แก้ production/Docker ที่ยังไม่ได้รัน `npm run db:wallet` หรือ AUTO_MIGRATE_WALLET_ON_START
 *
 * ปิดการ migrate อัตโนมัติ: SKIP_BUYER_WALLET_AUTO_MIGRATE=1
 */
import fs from 'fs';
import path from 'path';
import { pool } from '../models/db.js';
import { WALLET_MIGRATION_SQL_PATHS } from '../db/walletMigrationPaths.js';

function skipAutoMigrate() {
  const v = String(process.env.SKIP_BUYER_WALLET_AUTO_MIGRATE || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export async function ensureBuyerWalletSchemaOnStartup() {
  if (skipAutoMigrate()) return;

  const client = await pool.connect();
  try {
    const check = await client.query(
      `SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'buyer_wallets'
       LIMIT 1`
    );
    if (check.rows.length > 0) return;

    console.warn(
      '[buyer-wallet] buyer_wallets missing — applying migrations:',
      WALLET_MIGRATION_SQL_PATHS.map((p) => path.basename(p)).join(', ')
    );
    for (const sqlPath of WALLET_MIGRATION_SQL_PATHS) {
      const sql = fs.readFileSync(sqlPath, 'utf8');
      await client.query(sql);
    }
    console.info('[buyer-wallet] migrations applied OK');
  } catch (e) {
    console.error('[buyer-wallet] auto-migration failed:', e?.code, e?.message);
    if (e?.stack) console.error(e.stack);
  } finally {
    client.release();
  }
}
