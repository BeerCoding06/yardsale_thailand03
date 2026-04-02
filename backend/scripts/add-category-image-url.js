/**
 * เพิ่มคอลัมน์ categories.image_url ถ้ายังไม่มี (ฐานเก่า)
 * Usage: DATABASE_URL=... node scripts/add-category-image-url.js
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const sql = `
DO $ensure_cat_img$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE public.categories ADD COLUMN image_url TEXT;
  END IF;
END $ensure_cat_img$;
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
