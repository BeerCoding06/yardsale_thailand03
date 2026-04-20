/**
 * สร้างตาราง wallet / withdrawals / wallet_transactions + คอลัมน์ orders ที่เกี่ยวกับ escrow
 * Usage: DATABASE_URL=... node scripts/run-wallet-migration.js
 */
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import { WALLET_MIGRATION_SQL_PATHS } from '../db/walletMigrationPaths.js';

dotenv.config();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    for (const sqlPath of WALLET_MIGRATION_SQL_PATHS) {
      const sql = fs.readFileSync(sqlPath, 'utf8');
      await client.query(sql);
      console.log('[db:wallet] applied', path.basename(sqlPath));
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
