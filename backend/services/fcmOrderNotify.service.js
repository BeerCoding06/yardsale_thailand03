import { pool } from '../models/db.js';
import * as fcmTokenModel from '../models/fcmToken.model.js';
import * as firebaseMessaging from './firebaseMessaging.service.js';

/**
 * แจ้งผู้ขายเมื่อมีออเดอร์ใหม่ (ไม่ throw — log เท่านั้น)
 * @param {string} orderId UUID
 */
export async function notifySellersNewOrder(orderId) {
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

    await firebaseMessaging.sendToDevices(
      tokens,
      'New order',
      `You have a new order (#${orderId})`,
      { type: 'new_order', order_id: String(orderId) }
    );
  } catch (e) {
    console.warn('[fcm] notifySellersNewOrder:', e?.message || e);
  } finally {
    client.release();
  }
}

/**
 * แจ้งผู้ซื้อเมื่อชำระเงิน / ยืนยันสลิปสำเร็จ (order status = paid)
 * @param {string} buyerUserId UUID
 * @param {string} orderId UUID
 */
export async function notifyBuyerOrderPaid(buyerUserId, orderId) {
  if (!firebaseMessaging.isFcmConfigured()) return;
  if (!buyerUserId || !orderId) return;

  const client = await pool.connect();
  try {
    const tokens = await fcmTokenModel.listTokensForUser(client, buyerUserId);
    if (!tokens.length) return;

    const shortRef = String(orderId).replace(/-/g, '').slice(0, 12);
    await firebaseMessaging.sendToDevices(
      tokens,
      'Payment successful',
      `Your order is confirmed (#${shortRef}).`,
      { type: 'payment_paid', order_id: String(orderId) }
    );
  } catch (e) {
    console.warn('[fcm] notifyBuyerOrderPaid:', e?.message || e);
  } finally {
    client.release();
  }
}
