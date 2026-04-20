/**
 * รัน migration wallet ตอนสตาร์ทเซิร์ฟเวอร์ — ใช้เมื่อ Dokploy/Docker ยังไม่รัน SQL แยก
 * เปิด: AUTO_MIGRATE_WALLET_ON_START=1 (หรือ true/yes)
 */
import fs from 'fs';
import path from 'path';
import { pool } from '../models/db.js';
import { WALLET_MIGRATION_SQL_PATHS } from '../db/walletMigrationPaths.js';

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
    console.warn(
      '[wallet] applying',
      WALLET_MIGRATION_SQL_PATHS.map((p) => path.basename(p)).join(', '),
      '(AUTO_MIGRATE_WALLET_ON_START)'
    );
    for (const sqlPath of WALLET_MIGRATION_SQL_PATHS) {
      const sql = fs.readFileSync(sqlPath, 'utf8');
      await client.query(sql);
    }
    console.info('[wallet] migrations applied OK');
  } catch (e) {
    console.error('[wallet] AUTO_MIGRATE_WALLET_ON_START failed:', e?.code, e?.message);
  } finally {
    client.release();
  }
}
