/**
 * Buyer Wallet Service — refund logic, wallet credits/debits, and admin tools.
 *
 * Refund conditions:
 *  1. Order cancelled (and was previously paid)
 *  2. Order not shipped within 3 days after payment
 *  3. Product defect / admin manual trigger
 */

import { AppError } from '../utils/AppError.js';
import { pool, withTransaction } from '../models/db.js';
import * as orderModel from '../models/order.model.js';
import * as buyerWalletModel from '../models/buyerWallet.model.js';
import * as walletModel from '../models/wallet.model.js';
import * as fcmTokenModel from '../models/fcmToken.model.js';
import * as firebaseMessaging from './firebaseMessaging.service.js';
import { config } from '../config/index.js';
import { paginationMeta } from '../utils/pagination.js';

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return 0;
  return Number(x.toFixed(2));
}

/** PostgreSQL schema mismatch — degrade gracefully instead of 500 */
export function isBuyerWalletSchemaError(err) {
  const c = String(err?.code || '');
  if (c === '42P01' || c === '42703' || c === '42704') return true;
  const msg = String(err?.message || '');
  if (/relation\s+["'][^"']+["']\s+does not exist/i.test(msg)) return true;
  return false;
}

function walletUrl() {
  const base = String(config.publicWebUrl || '').replace(/\/$/, '') || 'http://localhost:3000';
  return `${base}/my-wallet`;
}

/** แจ้งเตือนผู้ซื้อเมื่อรีฟันด์เข้ากระเป๋า (ไม่ throw) */
async function notifyBuyerRefundCredited(userId, amount, orderId) {
  if (!firebaseMessaging.isFcmConfigured()) return;
  const client = await pool.connect();
  try {
    const tokens = await fcmTokenModel.listTokensForUser(client, userId);
    if (!tokens.length) return;
    const shortRef = String(orderId).replace(/-/g, '').slice(0, 12);
    const click = walletUrl();
    await firebaseMessaging.sendToDevices(
      tokens,
      'Refund credited to wallet',
      `฿${money(amount).toFixed(2)} has been added to your wallet for order #${shortRef}.`,
      { type: 'refund_credited', order_id: String(orderId), click_action: click },
      { clickAction: click }
    );
  } catch (e) {
    console.warn('[buyerWallet] notifyBuyerRefundCredited:', e?.message || e);
  } finally {
    client.release();
  }
}

export async function notifyBuyerOrderAutoCanceled(userId, orderId, amount) {
  if (!firebaseMessaging.isFcmConfigured()) return;
  const client = await pool.connect();
  try {
    const tokens = await fcmTokenModel.listTokensForUser(client, userId);
    if (!tokens.length) return;
    const shortRef = String(orderId).replace(/-/g, '').slice(0, 12);
    const click = walletUrl();
    await firebaseMessaging.sendToDevices(
      tokens,
      'Order automatically canceled',
      `Order #${shortRef} was automatically canceled because it was not shipped within 3 days. ฿${money(amount).toFixed(2)} has been returned to your wallet.`,
      { type: 'order_auto_canceled', order_id: String(orderId), click_action: click },
      { clickAction: click }
    );
  } catch (e) {
    console.warn('[buyerWallet] notifyBuyerOrderAutoCanceled:', e?.message || e);
  } finally {
    client.release();
  }
}

/**
 * Core refund logic — runs inside an existing transaction (client).
 * - Creates refund record
 * - Credits buyer wallet
 * - Inserts buyer_wallet_transaction
 * - Marks order as refund processed
 * - Writes financial audit log
 *
 * Idempotent: skips if refund already processed for this order.
 *
 * @param {import('pg').PoolClient} client
 * @param {{ orderId, userId, amount, reason, note?, actorUserId? }} opts
 * @returns {{ refunded: boolean, reason?: string, refund?: object, tx?: object }}
 */
export async function processRefund(client, { orderId, userId, amount, reason, note, actorUserId }) {
  const amt = money(amount);
  if (amt <= 0) return { refunded: false, reason: 'zero_amount' };

  const existing = await buyerWalletModel.findBuyerRefundTx(client, orderId, userId);
  if (existing) return { refunded: false, reason: 'already_refunded' };

  const existingRecord = await buyerWalletModel.findRefundByOrderId(client, orderId);
  if (existingRecord?.status === 'completed') return { refunded: false, reason: 'already_refunded' };

  let refundRecord;
  if (!existingRecord) {
    refundRecord = await buyerWalletModel.createRefundRecord(client, {
      orderId,
      userId,
      amount: amt,
      reason,
      note,
    });
  } else {
    refundRecord = existingRecord;
  }

  await buyerWalletModel.lockBuyerWallet(client, userId);
  const updatedWallet = await buyerWalletModel.creditBuyerWallet(client, userId, amt);
  if (!updatedWallet) {
    await buyerWalletModel.updateRefundStatus(client, refundRecord.id, 'failed');
    throw new AppError('Failed to credit buyer wallet', 500, 'WALLET_CREDIT_FAILED');
  }

  const tx = await buyerWalletModel.insertBuyerWalletTx(client, {
    user_id: userId,
    order_id: orderId,
    type: 'credit',
    source: 'refund',
    amount: amt,
    note: note || `Refund: ${reason}`,
  });

  await buyerWalletModel.updateRefundStatus(client, refundRecord.id, 'completed');
  await buyerWalletModel.setRefundProcessedAt(client, orderId);

  await walletModel.insertFinancialAudit(client, {
    actorUserId: actorUserId || null,
    action: 'buyer_refund_credited',
    entityType: 'order',
    entityId: orderId,
    details: { userId, amount: amt, reason, refund_id: refundRecord.id },
  });

  console.info('[buyerWallet] refund credited', { orderId, userId, amount: amt, reason });
  return { refunded: true, refund: refundRecord, tx };
}

/**
 * Deduct wallet balance for a purchase.
 * Called inside an existing transaction (client) during checkout.
 *
 * @returns {{ debited: boolean, amount: number, balance_after: number }}
 */
export async function useWalletForPurchase(client, { userId, amount, orderId }) {
  const amt = money(amount);
  if (amt <= 0) return { debited: false, amount: 0 };

  await buyerWalletModel.lockBuyerWallet(client, userId);
  const wallet = await buyerWalletModel.getBuyerWallet(client, userId);
  const available = money(wallet?.balance ?? 0);
  if (available < amt) {
    throw new AppError('Insufficient wallet balance', 400, 'INSUFFICIENT_WALLET_BALANCE');
  }

  const updated = await buyerWalletModel.debitBuyerWallet(client, userId, amt);
  if (!updated) throw new AppError('Failed to debit wallet', 500, 'WALLET_DEBIT_FAILED');

  await buyerWalletModel.insertBuyerWalletTx(client, {
    user_id: userId,
    order_id: orderId || null,
    type: 'debit',
    source: 'purchase',
    amount: amt,
    note: orderId ? `Purchase: order ${String(orderId).slice(0, 8)}` : 'Purchase',
  });

  await walletModel.insertFinancialAudit(client, {
    actorUserId: userId,
    action: 'buyer_wallet_purchase',
    entityType: 'order',
    entityId: orderId || null,
    details: { amount: amt, balance_after: money(updated.balance) },
  });

  console.info('[buyerWallet] purchase debit', { userId, orderId, amount: amt, balance_after: money(updated.balance) });
  return { debited: true, amount: amt, balance_after: money(updated.balance) };
}

/* ===== User-facing ===== */

export async function getMyBuyerWallet(userId) {
  const client = await pool.connect();
  try {
    try {
      await buyerWalletModel.ensureBuyerWallet(client, userId);
      const w = await buyerWalletModel.getBuyerWallet(client, userId);
      const txs = await buyerWalletModel.listBuyerWalletTxs(client, userId, { limit: 40, offset: 0 });
      return {
        success: true,
        wallet_schema_incomplete: false,
        wallet: {
          user_id: userId,
          balance: money(w?.balance ?? 0),
          updated_at: w?.updated_at ?? null,
        },
        transactions: txs.map(formatTxRow),
      };
    } catch (err) {
      if (!isBuyerWalletSchemaError(err)) throw err;
      console.warn('[buyerWallet] getMyBuyerWallet degraded', err.code, err.message);
      return {
        success: true,
        wallet_schema_incomplete: true,
        wallet: { user_id: userId, balance: 0, updated_at: null },
        transactions: [],
      };
    }
  } finally {
    client.release();
  }
}

export async function listMyBuyerWalletTxs(userId, { limit = 20, offset = 0 } = {}) {
  const lim = Math.min(100, Math.max(1, Number(limit) || 20));
  const off = Math.max(0, Number(offset) || 0);
  const client = await pool.connect();
  try {
    const total = await buyerWalletModel.countBuyerWalletTxs(client, userId);
    const rows = total > 0
      ? await buyerWalletModel.listBuyerWalletTxs(client, userId, { limit: lim, offset: off })
      : [];
    return {
      success: true,
      transactions: rows.map(formatTxRow),
      pagination: paginationMeta({ page: Math.floor(off / lim) + 1, pageSize: lim, total }),
    };
  } finally {
    client.release();
  }
}

function formatTxRow(row) {
  return {
    id: row.id,
    order_id: row.order_id,
    type: row.type,
    source: row.source,
    amount: money(row.amount),
    note: row.note,
    expires_at: row.expires_at,
    created_at: row.created_at,
  };
}

/* ===== Refund triggers ===== */

/**
 * ทริกเกอร์รีฟันด์เมื่อออเดอร์ถูกยกเลิก (เรียกจาก order.service.cancelOrder)
 * - ยกเลิกได้เฉพาะออเดอร์ที่เคยชำระแล้ว (paid)
 * - ไม่ throw — log เท่านั้น เพื่อไม่ให้กระทบ cancel flow
 */
export async function triggerRefundOnCancel(client, orderId, order) {
  try {
    const prevStatus = String(order?.status || '').toLowerCase();
    const wasPaid = prevStatus === 'paid';
    if (!wasPaid) {
      console.info('[buyerWallet] cancel: skip refund (was not paid)', { orderId, status: prevStatus });
      return { refunded: false, reason: 'not_paid' };
    }

    const amt = money(order.total_price);
    if (amt <= 0) return { refunded: false, reason: 'zero_amount' };

    const result = await processRefund(client, {
      orderId,
      userId: order.user_id,
      amount: amt,
      reason: 'order_cancelled',
      note: 'ออเดอร์ถูกยกเลิก — คืนเงินเข้ากระเป๋า',
    });

    if (result.refunded) {
      notifyBuyerRefundCredited(order.user_id, amt, orderId).catch(() => {});
    }
    return result;
  } catch (err) {
    console.error('[buyerWallet] triggerRefundOnCancel failed', { orderId, err: err?.message });
    return { refunded: false, reason: 'error', error: err?.message };
  }
}

/**
 * สแกนออเดอร์ที่ชำระแล้วแต่ไม่จัดส่งเกิน 3 วัน → รีฟันด์อัตโนมัติ
 * เรียกได้จาก admin endpoint หรือ cron
 */
export async function triggerUnshippedOrderRefunds(actorUserId = null) {
  const client = await pool.connect();
  const results = [];
  try {
    const orders = await buyerWalletModel.findOrdersPaidNotShipped(client, 3);
    console.info(`[buyerWallet] unshipped check: ${orders.length} eligible order(s)`);

    for (const order of orders) {
      try {
        const result = await withTransaction(async (tx) => {
          const amt = money(order.total_price);
          return processRefund(tx, {
            orderId: order.id,
            userId: order.user_id,
            amount: amt,
            reason: 'not_shipped_3_days',
            note: 'ไม่จัดส่งภายใน 3 วันหลังชำระเงิน — คืนเงินอัตโนมัติ',
            actorUserId,
          });
        });
        if (result.refunded) {
          notifyBuyerRefundCredited(order.user_id, order.total_price, order.id).catch(() => {});
        }
        results.push({ order_id: order.id, ...result });
      } catch (err) {
        console.error('[buyerWallet] unshipped refund failed', { orderId: order.id, err: err?.message });
        results.push({ order_id: order.id, refunded: false, reason: 'error', error: err?.message });
      }
    }
    return { checked: orders.length, results };
  } finally {
    client.release();
  }
}

/**
 * Admin: manual refund (product defect หรือกรณีพิเศษ)
 */
export async function adminManualRefund(adminUserId, { orderId, reason = 'admin_manual', note }) {
  const client = await pool.connect();
  let order;
  try {
    order = await orderModel.getOrderById(client, orderId);
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
    if (String(order.status).toLowerCase() !== 'paid') {
      throw new AppError('Can only refund paid orders', 400, 'INVALID_ORDER_STATUS');
    }
  } finally {
    client.release();
  }

  const amt = money(order.total_price);
  const result = await withTransaction(async (tx) => {
    return processRefund(tx, {
      orderId,
      userId: order.user_id,
      amount: amt,
      reason,
      note: note || 'Admin manual refund',
      actorUserId: adminUserId,
    });
  });

  if (result.refunded) {
    notifyBuyerRefundCredited(order.user_id, amt, orderId).catch(() => {});
  }
  return { ...result, order_id: orderId, amount: amt };
}

/* ===== Admin dashboard ===== */

export async function adminGetBuyerWalletSummary() {
  const client = await pool.connect();
  try {
    try {
      const agg = await buyerWalletModel.aggregateBuyerWallets(client);
      const pending = await client.query(
        `SELECT COUNT(*)::int AS n, COALESCE(SUM(amount),0)::numeric(14,2) AS total
         FROM refunds WHERE status = 'pending'`
      );
      return {
        success: true,
        wallet_schema_incomplete: false,
        total_wallets: agg.total_wallets,
        total_balance: money(agg.total_balance),
        pending_refunds: {
          count: pending.rows[0]?.n ?? 0,
          total_amount: money(pending.rows[0]?.total ?? 0),
        },
      };
    } catch (err) {
      if (!isBuyerWalletSchemaError(err)) throw err;
      return {
        success: true,
        wallet_schema_incomplete: true,
        total_wallets: 0,
        total_balance: 0,
        pending_refunds: { count: 0, total_amount: 0 },
      };
    }
  } finally {
    client.release();
  }
}

export async function adminListBuyerWalletTxs(query = {}) {
  const client = await pool.connect();
  try {
    const limit = Number(query.limit) || 50;
    const offset = Number(query.offset) || 0;
    try {
      const rows = await buyerWalletModel.listAllBuyerWalletTxsAdmin(client, {
        limit,
        offset,
        user_id: query.user_id || '',
        date_from: query.date_from || '',
        date_to: query.date_to || '',
      });
      const total = await buyerWalletModel.countAllBuyerWalletTxsAdmin(client, {
        user_id: query.user_id || '',
        date_from: query.date_from || '',
        date_to: query.date_to || '',
      });
      return {
        success: true,
        wallet_schema_incomplete: false,
        transactions: rows.map((r) => ({
          ...formatTxRow(r),
          user_email: r.user_email,
          user_name: r.user_name,
        })),
        pagination: { limit, offset, total },
      };
    } catch (err) {
      if (!isBuyerWalletSchemaError(err)) throw err;
      return { success: true, wallet_schema_incomplete: true, transactions: [], pagination: { limit, offset, total: 0 } };
    }
  } finally {
    client.release();
  }
}

export async function adminListRefunds(query = {}) {
  const client = await pool.connect();
  try {
    const limit = Number(query.limit) || 50;
    const offset = Number(query.offset) || 0;
    try {
      const rows = await buyerWalletModel.listRefundsAdmin(client, {
        limit,
        offset,
        status: query.status || '',
        date_from: query.date_from || '',
        date_to: query.date_to || '',
      });
      return { success: true, wallet_schema_incomplete: false, refunds: rows, pagination: { limit, offset } };
    } catch (err) {
      if (!isBuyerWalletSchemaError(err)) throw err;
      return { success: true, wallet_schema_incomplete: true, refunds: [], pagination: { limit, offset } };
    }
  } finally {
    client.release();
  }
}

/* ===== User-Initiated Refund Request ===== */

const ALLOWED_USER_REASONS = new Set(['product_defect', 'not_shipped_3_days']);

/**
 * ผู้ซื้อส่งคำขอคืนเงิน — ต้องรอแอดมินอนุมัติ
 */
export async function userRequestRefund(userId, { orderId, reason = 'product_defect', note, evidencePaths, productItems }) {
  if (!ALLOWED_USER_REASONS.has(reason)) {
    throw new AppError('Invalid refund reason', 422, 'INVALID_REASON');
  }

  const paths = Array.isArray(evidencePaths)
    ? evidencePaths.filter((p) => typeof p === 'string' && p.trim())
    : [];
  if (paths.length < 1) {
    throw new AppError(
      'Please attach at least one photo (maximum 5).',
      422,
      'EVIDENCE_REQUIRED'
    );
  }
  if (paths.length > 5) {
    throw new AppError('Too many files (maximum 5).', 422, 'TOO_MANY_FILES');
  }

  const client = await pool.connect();
  try {
    // ตรวจสอบออเดอร์
    const order = await orderModel.getOrderById(client, orderId);
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
    if (order.user_id !== userId) throw new AppError('Forbidden', 403, 'FORBIDDEN');
    if (String(order.status).toLowerCase() !== 'paid') {
      throw new AppError('Only paid orders can be refunded', 400, 'INVALID_ORDER_STATUS');
    }
    if (order.refund_processed_at) {
      throw new AppError('This order has already been refunded', 400, 'ALREADY_REFUNDED');
    }

    // ตรวจ duplicate request
    const existing = await buyerWalletModel.findRefundRequestByOrderId(client, orderId);
    if (existing) {
      throw new AppError(
        existing.status === 'rejected'
          ? 'Your refund request was rejected. Contact support for assistance.'
          : 'A refund request for this order already exists.',
        400,
        'DUPLICATE_REQUEST'
      );
    }

    // Validate provided product items (if any) against order items
    let normalizedItems = [];
    if (productItems != null) {
      const provided = Array.isArray(productItems) ? productItems : [];
      if (!provided.length) {
        throw new AppError('product_items must be a non-empty array', 422, 'VALIDATION_ERROR');
      }

      const orderItems = await orderModel.getOrderItems(client, orderId);
      const avail = new Map();
      for (const it of orderItems) {
        avail.set(String(it.product_id).trim().toLowerCase(), Number(it.quantity) || 0);
      }

      for (const it of provided) {
        if (it == null) continue;
        if (typeof it === 'string') {
          const pid = String(it).trim();
          if (!pid) continue;
          if (!avail.has(pid.toLowerCase())) throw new AppError(`Product not in order: ${pid}`, 422, 'INVALID_PRODUCT');
          normalizedItems.push({ product_id: pid, quantity: avail.get(pid.toLowerCase()) });
          continue;
        }
        if (typeof it === 'object') {
          const pid = String(it.product_id || it.productId || it.id || '').trim();
          if (!pid) continue;
          if (!avail.has(pid.toLowerCase())) throw new AppError(`Product not in order: ${pid}`, 422, 'INVALID_PRODUCT');
          const q = Number(it.quantity) || avail.get(pid.toLowerCase()) || 1;
          if (q <= 0) throw new AppError(`Invalid quantity for ${pid}`, 422, 'VALIDATION_ERROR');
          if (q > (avail.get(pid.toLowerCase()) || 0)) throw new AppError(`Quantity exceeds ordered amount for ${pid}`, 422, 'INVALID_QUANTITY');
          normalizedItems.push({ product_id: pid, quantity: q });
          continue;
        }
        throw new AppError('Invalid product_items format', 422, 'VALIDATION_ERROR');
      }
    }

    const req = await buyerWalletModel.createRefundRequest(client, {
      orderId,
      userId,
      reason,
      note: note ? String(note).trim().slice(0, 500) : null,
      evidencePaths: paths,
      productItems: normalizedItems,
    });

    console.info('[buyerWallet] refund_request created', { orderId, userId, reason });
    return { success: true, request: req };
  } finally {
    client.release();
  }
}

/** รายการคำขอคืนเงินของผู้ซื้อ */
export async function listMyRefundRequests(userId, { limit = 20, offset = 0 } = {}) {
  const client = await pool.connect();
  try {
    try {
      const rows = await buyerWalletModel.listRefundRequestsForUser(client, userId, { limit, offset });
      return { success: true, requests: rows };
    } catch (err) {
      if (!isBuyerWalletSchemaError(err)) throw err;
      return { success: true, requests: [] };
    }
  } finally {
    client.release();
  }
}

/** ออเดอร์ที่สามารถขอคืนเงินได้ */
export async function listEligibleOrdersForRefund(userId) {
  const client = await pool.connect();
  try {
    try {
      const rows = await buyerWalletModel.listEligibleOrdersForRefundRequest(client, userId);
      return { success: true, orders: rows };
    } catch (err) {
      if (!isBuyerWalletSchemaError(err)) throw err;
      return { success: true, orders: [] };
    }
  } finally {
    client.release();
  }
}

/* ===== Admin: Review Refund Requests ===== */

export async function adminListRefundRequests(query = {}) {
  const client = await pool.connect();
  try {
    const limit = Number(query.limit) || 50;
    const offset = Number(query.offset) || 0;
    try {
      const rows = await buyerWalletModel.listRefundRequestsAdmin(client, {
        limit,
        offset,
        status: query.status || '',
        date_from: query.date_from || '',
        date_to: query.date_to || '',
      });
      const total = await buyerWalletModel.countRefundRequestsAdmin(client, { status: query.status || '' });
      return { success: true, requests: rows, pagination: { limit, offset, total } };
    } catch (err) {
      if (!isBuyerWalletSchemaError(err)) throw err;
      return { success: true, requests: [], pagination: { limit, offset, total: 0 } };
    }
  } finally {
    client.release();
  }
}

/**
 * Admin อนุมัติคำขอ → ประมวลผล refund ทันที
 */
export async function adminApproveRefundRequest(adminUserId, requestId, adminNote) {
  return withTransaction(async (client) => {
    const req = await buyerWalletModel.lockRefundRequestById(client, requestId);
    if (!req) throw new AppError('Refund request not found', 404, 'NOT_FOUND');
    if (req.status !== 'pending') {
      throw new AppError(`Request is already ${req.status}`, 400, 'INVALID_STATUS');
    }

    const amt = money(req.order_amount);
    if (amt <= 0) throw new AppError('Order amount is zero', 400, 'ZERO_AMOUNT');

    // ประมวลผล refund เข้า wallet
    const refundResult = await processRefund(client, {
      orderId: req.order_id,
      userId: req.order_user_id,
      amount: amt,
      reason: req.reason || 'product_defect',
      note: adminNote || `Approved by admin: ${req.reason}`,
      actorUserId: adminUserId,
    });

    if (!refundResult.refunded) {
      throw new AppError(
        `Cannot process refund: ${refundResult.reason}`,
        400,
        'REFUND_FAILED'
      );
    }

    // อัปเดตสถานะคำขอ
    const updated = await buyerWalletModel.updateRefundRequest(client, requestId, {
      status: 'approved',
      adminId: adminUserId,
      adminNote: adminNote || null,
      refundId: refundResult.refund?.id || null,
    });

    await walletModel.insertFinancialAudit(client, {
      actorUserId: adminUserId,
      action: 'refund_request_approved',
      entityType: 'refund_request',
      entityId: requestId,
      details: { order_id: req.order_id, amount: amt, user_id: req.order_user_id },
    });

    console.info('[buyerWallet] refund_request approved', { requestId, adminUserId, amount: amt });
    notifyBuyerRefundCredited(req.order_user_id, amt, req.order_id).catch(() => {});
    return { success: true, request: updated, refund: refundResult };
  });
}

/**
 * Admin ปฏิเสธคำขอ
 */
export async function adminRejectRefundRequest(adminUserId, requestId, adminNote, rejectionReason) {
  return withTransaction(async (client) => {
    const req = await buyerWalletModel.lockRefundRequestById(client, requestId);
    if (!req) throw new AppError('Refund request not found', 404, 'NOT_FOUND');
    if (req.status !== 'pending') {
      throw new AppError(`Request is already ${req.status}`, 400, 'INVALID_STATUS');
    }

    const updated = await buyerWalletModel.updateRefundRequest(client, requestId, {
      status: 'rejected',
      adminId: adminUserId,
      adminNote: adminNote || null,
      rejectionReason: rejectionReason || null,
    });

    await walletModel.insertFinancialAudit(client, {
      actorUserId: adminUserId,
      action: 'refund_request_rejected',
      entityType: 'refund_request',
      entityId: requestId,
      details: { order_id: req.order_id, reason: adminNote, rejection_reason: rejectionReason || null },
    });

    console.info('[buyerWallet] refund_request rejected', { requestId, adminUserId });
    return { success: true, request: updated };
  });
}
