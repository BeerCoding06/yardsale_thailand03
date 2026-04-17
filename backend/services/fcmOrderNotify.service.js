import { config } from '../config/index.js';
import { pool } from '../models/db.js';
import * as fcmTokenModel from '../models/fcmToken.model.js';
import * as firebaseMessaging from './firebaseMessaging.service.js';

function ordersUrlForPush() {
  const base = String(config.publicWebUrl || '').replace(/\/$/, '') || 'http://localhost:3000';
  return `${base}/my-orders`;
}

/**
 * แจ้งผู้ขายเมื่อผู้ซื้อชำระเงินสำเร็จ (ไม่ throw — log เท่านั้น)
 * @param {string} orderId UUID
 */
export async function notifySellersOrderPaid(orderId) {
  if (!firebaseMessaging.isFcmConfigured()) return;

  const client = await pool.connect();
  try {
    const sellerIds = await fcmTokenModel.listSellerIdsForOrder(client, orderId);
    if (!sellerIds.length) return;

    const tokenSet = new Set();
    for (const sid of sellerIds) {
      const tokens = await fcmTokenModel.listTokensForUser(client, sid);
      for (const t of tokens) tokenSet.add(t);
    }
    const tokens = [...tokenSet];
    if (!tokens.length) return;

    const shortRef = String(orderId).replace(/-/g, '').slice(0, 12);
    const click = ordersUrlForPush();
    await firebaseMessaging.sendToDevices(
      tokens,
      'Payment received',
      `A buyer paid for order #${shortRef}.`,
      { type: 'order_paid', order_id: String(orderId), click_action: click },
      { clickAction: click }
    );
  } catch (e) {
    console.warn('[fcm] notifySellersOrderPaid:', e?.message || e);
  } finally {
    client.release();
  }
}
