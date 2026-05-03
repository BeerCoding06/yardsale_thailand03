/**
 * ถ้ายังไม่มีตาราง support chat — รัน migration ครั้งเดียวตอนสตาร์ท
 * แก้เคส Dokploy/production ที่ยังไม่ได้รัน `npm run db:support-chat`
 *
 * ปิดการ migrate อัตโนมัติ: SKIP_SUPPORT_CHAT_AUTO_MIGRATE=1
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../models/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function skipAutoMigrate() {
  const v = String(process.env.SKIP_SUPPORT_CHAT_AUTO_MIGRATE || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export async function ensureSupportChatSchemaOnStartup() {
  if (skipAutoMigrate()) return;

  const client = await pool.connect();
  try {
    const check = await client.query(
      `SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'support_conversations'
       LIMIT 1`
    );
    if (check.rows.length > 0) return;

    const sqlPath = path.join(__dirname, '../db/migrations/20260430_support_chat.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.warn('[support-chat] support_conversations missing — applying migration from', path.basename(sqlPath));
    await client.query(sql);
    console.info('[support-chat] migration applied OK');
  } catch (e) {
    console.error('[support-chat] auto-migration failed:', e?.code, e?.message);
    if (e?.stack) console.error(e.stack);
  } finally {
    client.release();
  }
}
