/**
 * Apply db/schema.sql
 * Usage: DATABASE_URL=... node scripts/run-schema.js
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
  const sql = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
    /* บังคับรันอีกครั้ง — บางทีไฟล์ยาวหลาย statement ทำให้บล็อก DO ไม่ถูก apply; ฐานเก่าจะได้คอลัมน์ image_url */
    await client.query(`
DO $ensure_cat_img$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE public.categories ADD COLUMN image_url TEXT;
  END IF;
END $ensure_cat_img$;
`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
