import { pool } from '../models/db.js';
import * as firebaseMessaging from './firebaseMessaging.service.js';

const PAGE_SIZE = Number(process.env.FCM_BROADCAST_PAGE_SIZE || 500);
const DELAY_MS = Number(process.env.FCM_BROADCAST_DELAY_MS || 80);

/**
 * ส่งแจ้งเตือนไปยังทุก token ในตาราง (แบ่งหน้า + delay กัน rate limit)
 * @param {{ title: string, body: string, image?: string, click_action?: string, data?: Record<string, unknown> }} payload
 */
export async function broadcastToAllTokens(payload) {
  const { title, body, image, click_action, data = {} } = payload;
  const client = await pool.connect();
  let offset = 0;
  let sent = 0;
  let failed = 0;
  let chunks = 0;
  try {
    while (true) {
      const r = await client.query(
        `SELECT token FROM fcm_tokens ORDER BY updated_at DESC LIMIT $1 OFFSET $2`,
        [PAGE_SIZE, offset]
      );
      if (!r.rows.length) break;
      const tokens = r.rows.map((x) => x.token);
      chunks += 1;
      const results = await firebaseMessaging.sendToDevices(tokens, title, body, data, {
        image,
        clickAction: click_action,
      });
      sent += results.filter((x) => x.ok).length;
      failed += results.filter((x) => !x.ok).length;
      offset += PAGE_SIZE;
      if (r.rows.length < PAGE_SIZE) break;
      await new Promise((res) => setTimeout(res, DELAY_MS));
    }
  } finally {
    client.release();
  }
  return { sent, failed, chunks };
}
