/**
 * สร้างตาราง/column OAuth เท่าที่จำเป็น — แกน "relation user_oauth_identities does not exist"
 * Usage: DATABASE_URL=postgresql://... npm run db:oauth
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL required (same connection string as backend)");
    process.exit(1);
  }
  const sqlPath = path.join(__dirname, "../db/oauth_patch.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
    console.info("[db:oauth] applied", sqlPath);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
