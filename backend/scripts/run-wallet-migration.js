/**
 * สร้างตาราง wallet / withdrawals / wallet_transactions + คอลัมน์ orders ที่เกี่ยวกับ escrow
 * Usage: DATABASE_URL=... node scripts/run-wallet-migration.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  const sqlPath = path.join(__dirname, '../db/migrations/20260417_seller_wallet_system.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
    console.log('[db:wallet] applied', sqlPath);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
