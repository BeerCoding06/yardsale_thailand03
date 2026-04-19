import { AppError } from '../utils/AppError.js';
import { pool, withTransaction } from '../models/db.js';
import { THAI_PAYOUT_BANKS } from '../constants/thaiPayoutBanks.js';
import { WITHDRAWAL_FEE_PERCENT, WITHDRAWAL_FEE_RATE } from '../constants/withdrawalFees.js';
import {
  buildWithdrawalNoticesEn,
  buildWithdrawalNoticesTh,
  buildWithdrawalPolicyNoticesEn,
  buildWithdrawalPolicyNoticesTh,
  computeWithdrawalFeeBreakdown,
} from '../utils/withdrawalDisclosure.js';
import * as orderModel from '../models/order.model.js';
import * as walletModel from '../models/wallet.model.js';
import * as withdrawalModel from '../models/withdrawal.model.js';

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return 0;
  return Number(x.toFixed(2));
}

function isPaidStatus(raw) {
  if (raw == null) return false;
  if (typeof raw === 'object') {
    const v = String(raw.value || raw.name || '').toLowerCase();
    return v === 'paid';
  }
  return String(raw).toLowerCase() === 'paid';
}

function formatWalletRow(row) {
  if (!row) return null;
  return {
    seller_id: row.seller_id,
    available_balance: money(row.available_balance),
    escrow_balance: money(row.escrow_balance),
    updated_at: row.updated_at,
  };
}

export function getPayoutBankOptions() {
  return {
    success: true,
    fee_percent: WITHDRAWAL_FEE_PERCENT,
    fee_rate: WITHDRAWAL_FEE_RATE,
    banks: THAI_PAYOUT_BANKS,
    policy_notices_th: buildWithdrawalPolicyNoticesTh(),
    policy_notices_en: buildWithdrawalPolicyNoticesEn(),
  };
}

function normalizeAccountHolder(raw) {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, ' ');
}

/** เก็บเฉพาะตัวเลข — ตัดขีดและช่องว่าง */
function normalizeAccountNumber(raw) {
  return String(raw || '').replace(/\D/g, '');
}

function formatTxRow(row) {
  return {
    id: row.id,
    order_id: row.order_id,
    withdrawal_id: row.withdrawal_id,
    type: row.type,
    amount: money(row.amount),
    status: row.status,
    metadata: row.metadata,
    created_at: row.created_at,
  };
}

/** PostgreSQL / migration mismatch — degrade seller + admin wallet APIs instead of 500 */
function isWalletDashboardSchemaError(err) {
  const c = String(err?.code || '');
  if (c === '42P01' || c === '42703' || c === '42704') return true;
  const msg = String(err?.message || '');
  if (/relation\s+["'][^"']+["']\s+does not exist/i.test(msg)) return true;
  return false;
}

/**
 * When an order becomes paid: credit each seller's escrow from line items (idempotent per seller).
 */
export async function recordEscrowForPaidOrder(client, orderId) {
  const order = await orderModel.lockOrderForUpdate(client, orderId);
  if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
  if (!isPaidStatus(order.status)) {
    return { skipped: true, reason: 'not_paid' };
  }

  const shares = await orderModel.listSellerSubtotalsForOrder(client, orderId);
  for (const row of shares) {
    const sellerId = row.seller_id;
    const amt = money(row.amount);
    if (!sellerId || amt <= 0) continue;

    const existing = await walletModel.findEscrowTransaction(client, orderId, sellerId);
    if (existing) continue;

    await walletModel.ensureSellerWallet(client, sellerId);
    await walletModel.lockSellerWallet(client, sellerId);
    const updated = await walletModel.addEscrow(client, sellerId, amt);
    if (!updated) {
      throw new AppError('Failed to update escrow balance', 500, 'WALLET_UPDATE_FAILED');
    }
    await walletModel.insertWalletTransaction(client, {
      seller_id: sellerId,
      order_id: orderId,
      withdrawal_id: null,
      type: 'escrow_in',
      amount: amt,
      status: 'completed',
      metadata: { order_id: orderId },
    });
    await walletModel.insertFinancialAudit(client, {
      actorUserId: null,
      action: 'escrow_in',
      entityType: 'order',
      entityId: orderId,
      details: { seller_id: sellerId, amount: amt },
    });
    console.info('[wallet] escrow_in', { orderId, sellerId, amount: amt });
  }
  return { skipped: false };
}

/**
 * Release escrow → available when delivery criteria met (idempotent per seller).
 * Criteria: order paid AND (shipping_status = delivered OR buyer_confirmed_delivery_at set).
 */
export async function tryReleaseOrderFunds(client, orderId, trigger = 'unknown') {
  const order = await orderModel.lockOrderForUpdate(client, orderId);
  if (!order) return { released: false, reason: 'not_found' };
  if (!isPaidStatus(order.status)) {
    return { released: false, reason: 'not_paid' };
  }

  const ship = String(order.shipping_status || '').toLowerCase();
  const buyerConfirmed = order.buyer_confirmed_delivery_at != null;
  if (ship !== 'delivered' && !buyerConfirmed) {
    return { released: false, reason: 'delivery_not_confirmed' };
  }

  const shares = await orderModel.listSellerSubtotalsForOrder(client, orderId);
  let releasedAny = false;

  for (const row of shares) {
    const sellerId = row.seller_id;
    const amt = money(row.amount);
    if (!sellerId || amt <= 0) continue;

    const already = await walletModel.findReleaseTransaction(client, orderId, sellerId);
    if (already) continue;

    const hadEscrow = await walletModel.findEscrowTransaction(client, orderId, sellerId);
    if (!hadEscrow) continue;

    await walletModel.ensureSellerWallet(client, sellerId);
    await walletModel.lockSellerWallet(client, sellerId);
    const moved = await walletModel.moveEscrowToAvailable(client, sellerId, amt);
    if (!moved) {
      await walletModel.insertFinancialAudit(client, {
        actorUserId: null,
        action: 'release_failed_insufficient_escrow',
        entityType: 'order',
        entityId: orderId,
        details: { seller_id: sellerId, amount: amt, trigger },
      });
      console.warn('[wallet] release_failed_insufficient_escrow', { orderId, sellerId, amt });
      continue;
    }

    await walletModel.insertWalletTransaction(client, {
      seller_id: sellerId,
      order_id: orderId,
      withdrawal_id: null,
      type: 'release',
      amount: amt,
      status: 'completed',
      metadata: { trigger },
    });
    await walletModel.insertFinancialAudit(client, {
      actorUserId: null,
      action: 'release',
      entityType: 'order',
      entityId: orderId,
      details: { seller_id: sellerId, amount: amt, trigger },
    });
    console.info('[wallet] release', { orderId, sellerId, amount: amt, trigger });
    releasedAny = true;
  }

  const need = await orderModel.countSellersWithPositiveShareForOrder(client, orderId);
  const have = await walletModel.countReleaseTransactionsForOrder(client, orderId);
  if (need > 0 && have >= need) {
    await orderModel.setFundsSettledAtIfUnset(client, orderId);
  }

  return { released: releasedAny };
}

export async function getWalletOverview(userId) {
  const client = await pool.connect();
  try {
    try {
      await walletModel.ensureSellerWallet(client, userId);
      const w = await walletModel.getSellerWallet(client, userId);
      const tx = await walletModel.listWalletTransactionsForSeller(client, userId, { limit: 40, offset: 0 });
      return {
        success: true,
        wallet_schema_incomplete: false,
        wallet: formatWalletRow(w) || {
          seller_id: userId,
          available_balance: 0,
          escrow_balance: 0,
          updated_at: null,
        },
        transactions: tx.map(formatTxRow),
        withdrawal_policy: {
          fee_percent: WITHDRAWAL_FEE_PERCENT,
          fee_rate: WITHDRAWAL_FEE_RATE,
          notices_th: buildWithdrawalPolicyNoticesTh(),
          notices_en: buildWithdrawalPolicyNoticesEn(),
        },
      };
    } catch (err) {
      if (!isWalletDashboardSchemaError(err)) throw err;
      console.warn('[wallet] getWalletOverview degraded (schema)', err.code, err.message);
      return {
        success: true,
        wallet_schema_incomplete: true,
        wallet: {
          seller_id: userId,
          available_balance: 0,
          escrow_balance: 0,
          updated_at: null,
        },
        transactions: [],
        withdrawal_policy: {
          fee_percent: WITHDRAWAL_FEE_PERCENT,
          fee_rate: WITHDRAWAL_FEE_RATE,
          notices_th: buildWithdrawalPolicyNoticesTh(),
          notices_en: buildWithdrawalPolicyNoticesEn(),
        },
      };
    }
  } finally {
    client.release();
  }
}

export async function requestWithdrawal(sellerId, body) {
  const amount = money(body?.amount);
  if (amount <= 0) {
    throw new AppError('Amount must be greater than zero', 422, 'VALIDATION_ERROR');
  }

  const bankCode = String(body?.bank_code || '')
    .trim()
    .toUpperCase();
  const accountName = normalizeAccountHolder(body?.account_holder_name);
  const accountNumber = normalizeAccountNumber(body?.account_number);
  if (!bankCode) {
    throw new AppError('bank_code is required', 422, 'VALIDATION_ERROR');
  }
  if (accountName.length < 2) {
    throw new AppError('account_holder_name is required', 422, 'VALIDATION_ERROR');
  }
  if (accountNumber.length < 8 || accountNumber.length > 20) {
    throw new AppError('account_number must be 8–20 digits', 422, 'VALIDATION_ERROR');
  }

  return withTransaction(async (client) => {
    await walletModel.ensureSellerWallet(client, sellerId);
    await walletModel.lockSellerWallet(client, sellerId);
    const w = await walletModel.getSellerWallet(client, sellerId);
    const breakdown = computeWithdrawalFeeBreakdown(amount);
    if (breakdown.net_payout_amount <= 0) {
      throw new AppError('Withdrawal amount too small after fee', 422, 'VALIDATION_ERROR');
    }

    if (money(w.available_balance) < breakdown.gross_amount) {
      throw new AppError('Insufficient available balance', 400, 'INSUFFICIENT_BALANCE');
    }

    const wd = await withdrawalModel.createWithdrawal(client, {
      sellerId,
      amount: breakdown.gross_amount,
      payoutBankCode: bankCode,
      payoutAccountName: accountName,
      payoutAccountNumber: accountNumber,
      withdrawalFeeAmount: breakdown.fee_amount,
      netPayoutAmount: breakdown.net_payout_amount,
    });
    const after = await walletModel.deductAvailable(client, sellerId, breakdown.gross_amount);
    if (!after) {
      throw new AppError('Insufficient available balance', 400, 'INSUFFICIENT_BALANCE');
    }

    await walletModel.insertWalletTransaction(client, {
      seller_id: sellerId,
      order_id: null,
      withdrawal_id: wd.id,
      type: 'withdraw',
      amount: breakdown.gross_amount,
      status: 'completed',
      metadata: {
        note: 'Withdrawal requested; payout within 3 business days.',
        bank_code: bankCode,
        fee_percent: breakdown.fee_percent,
        fee_amount: breakdown.fee_amount,
        net_payout_amount: breakdown.net_payout_amount,
        gross_amount: breakdown.gross_amount,
      },
    });

    await walletModel.insertFinancialAudit(client, {
      actorUserId: sellerId,
      action: 'withdraw_request',
      entityType: 'withdrawal',
      entityId: wd.id,
      details: {
        gross_amount: breakdown.gross_amount,
        fee_amount: breakdown.fee_amount,
        net_payout_amount: breakdown.net_payout_amount,
        bank_code: bankCode,
        account_holder_name: accountName,
        account_number_suffix: accountNumber.slice(-4),
      },
    });
    console.info('[wallet] withdraw_request', {
      sellerId,
      withdrawalId: wd.id,
      gross: breakdown.gross_amount,
      fee: breakdown.fee_amount,
      net: breakdown.net_payout_amount,
      bankCode,
    });

    const noticesTh = buildWithdrawalNoticesTh(breakdown);
    const noticesEn = buildWithdrawalNoticesEn(breakdown);

    return {
      success: true,
      message:
        `ส่งคำขอถอนเงินแล้ว หักจากยอดถอนได้ ${breakdown.gross_amount.toFixed(2)} บาท ` +
        `(ค่าธรรมเนียม ${breakdown.fee_percent}% = ${breakdown.fee_amount.toFixed(2)} บาท) ` +
        `คาดว่าโอนเข้าบัญชี ${breakdown.net_payout_amount.toFixed(2)} บาท (สุทธิ) ภายใน 3 วันทำการหลังแอดมินอนุมัติ`,
      message_en: `Withdrawal submitted. Deducted ${breakdown.gross_amount.toFixed(2)} THB gross; fee ${breakdown.fee_percent}% (${breakdown.fee_amount.toFixed(2)} THB); estimated bank payout ${breakdown.net_payout_amount.toFixed(2)} THB net within ~3 business days after approval.`,
      fee_breakdown: {
        gross_amount: breakdown.gross_amount,
        fee_percent: breakdown.fee_percent,
        fee_rate: breakdown.fee_rate,
        fee_amount: breakdown.fee_amount,
        net_payout_amount: breakdown.net_payout_amount,
      },
      notices_th: noticesTh,
      notices_en: noticesEn,
      withdrawal: {
        id: wd.id,
        amount: money(wd.amount),
        withdrawal_fee_amount: money(wd.withdrawal_fee_amount),
        net_payout_amount: money(wd.net_payout_amount),
        status: wd.status,
        requested_at: wd.requested_at,
        bank_code: wd.payout_bank_code,
        account_holder_name: wd.payout_account_name,
        /** ไม่ส่งเลขบัญช์เต็มกลับ API — แสดงเฉพาะท้าย 4 หลัก */
        account_number_last4: accountNumber.slice(-4),
      },
    };
  });
}

export async function listMyWithdrawals(sellerId, { limit = 50, offset = 0 } = {}) {
  const client = await pool.connect();
  try {
    try {
      const rows = await withdrawalModel.listWithdrawalsForSeller(client, sellerId, { limit, offset });
      return {
        success: true,
        wallet_schema_incomplete: false,
        withdrawals: rows.map((r) => ({
          id: r.id,
          amount: money(r.amount),
          withdrawal_fee_amount:
            r.withdrawal_fee_amount != null ? money(r.withdrawal_fee_amount) : null,
          net_payout_amount: r.net_payout_amount != null ? money(r.net_payout_amount) : null,
          status: r.status,
          admin_notes: r.admin_notes,
          requested_at: r.requested_at,
          processed_at: r.processed_at,
          bank_code: r.payout_bank_code ?? null,
          account_holder_name: r.payout_account_name ?? null,
          account_number_last4: r.payout_account_number
            ? String(r.payout_account_number).replace(/\D/g, '').slice(-4) || null
            : null,
        })),
      };
    } catch (err) {
      if (!isWalletDashboardSchemaError(err)) throw err;
      console.warn('[wallet] listMyWithdrawals degraded (schema)', err.code, err.message);
      return {
        success: true,
        wallet_schema_incomplete: true,
        withdrawals: [],
      };
    }
  } finally {
    client.release();
  }
}

export async function getAdminWithdrawalDashboard() {
  const client = await pool.connect();
  try {
    let withdrawalsByStatus = {};
    let schemaIncomplete = false;
    try {
      withdrawalsByStatus = await walletModel.countWithdrawalsByStatus(client);
    } catch (err) {
      if (!isWalletDashboardSchemaError(err)) throw err;
      schemaIncomplete = true;
      console.warn('[wallet] admin dashboard: withdrawals summary skipped', err.code, err.message);
    }

    let sumAvailable = 0;
    let sumEscrow = 0;
    try {
      const agg = await client.query(
        `SELECT COALESCE(SUM(available_balance),0)::numeric AS a,
                COALESCE(SUM(escrow_balance),0)::numeric AS e
         FROM seller_wallets`
      );
      sumAvailable = money(agg.rows[0]?.a);
      sumEscrow = money(agg.rows[0]?.e);
    } catch (err) {
      if (!isWalletDashboardSchemaError(err)) throw err;
      schemaIncomplete = true;
      console.warn('[wallet] admin dashboard: seller_wallets totals skipped', err.code, err.message);
    }

    return {
      success: true,
      wallet_schema_incomplete: schemaIncomplete,
      withdrawals_by_status: withdrawalsByStatus,
      platform_balances: {
        sum_available: sumAvailable,
        sum_escrow: sumEscrow,
      },
    };
  } finally {
    client.release();
  }
}

export async function adminListWithdrawals(query) {
  const client = await pool.connect();
  try {
    const limit = Number(query.limit) || 50;
    const offset = Number(query.offset) || 0;
    const status = query.status ? String(query.status).trim() : '';
    try {
      const rows = await walletModel.listWithdrawalsAdmin(client, { status, limit, offset });
      const total = await walletModel.countWithdrawalsAdmin(client, { status });
      return {
        success: true,
        wallet_schema_incomplete: false,
        withdrawals: rows,
        pagination: { limit, offset, total },
      };
    } catch (err) {
      if (!isWalletDashboardSchemaError(err)) throw err;
      console.warn('[wallet] admin withdrawals list unavailable', err.code, err.message);
      return {
        success: true,
        wallet_schema_incomplete: true,
        withdrawals: [],
        pagination: { limit, offset, total: 0 },
      };
    }
  } finally {
    client.release();
  }
}

export async function adminApproveWithdrawal(adminUserId, withdrawalId, adminNotes) {
  return withTransaction(async (client) => {
    const row = await withdrawalModel.lockWithdrawalById(client, withdrawalId);
    if (!row) throw new AppError('Withdrawal not found', 404, 'NOT_FOUND');
    if (row.status !== 'pending') {
      throw new AppError('Only pending withdrawals can be approved', 400, 'INVALID_STATUS');
    }
    const updated = await withdrawalModel.updateWithdrawal(client, withdrawalId, {
      status: 'approved',
      adminNotes: adminNotes != null ? String(adminNotes) : row.admin_notes,
      processedAt: null,
    });
    await walletModel.insertFinancialAudit(client, {
      actorUserId: adminUserId,
      action: 'withdraw_approve',
      entityType: 'withdrawal',
      entityId: withdrawalId,
      details: {},
    });
    console.info('[wallet] withdraw_approve', { adminUserId, withdrawalId });
    return { success: true, withdrawal: updated };
  });
}

export async function adminRejectWithdrawal(adminUserId, withdrawalId, adminNotes) {
  return withTransaction(async (client) => {
    const row = await withdrawalModel.lockWithdrawalById(client, withdrawalId);
    if (!row) throw new AppError('Withdrawal not found', 404, 'NOT_FOUND');
    if (row.status !== 'pending') {
      throw new AppError('Only pending withdrawals can be rejected', 400, 'INVALID_STATUS');
    }

    const sellerId = row.seller_id;
    const amount = money(row.amount);

    await walletModel.ensureSellerWallet(client, sellerId);
    await walletModel.lockSellerWallet(client, sellerId);
    await walletModel.creditAvailable(client, sellerId, amount);

    await walletModel.insertWalletTransaction(client, {
      seller_id: sellerId,
      order_id: null,
      withdrawal_id: row.id,
      type: 'refund',
      amount,
      status: 'completed',
      metadata: { reason: 'withdrawal_rejected' },
    });

    const updated = await withdrawalModel.updateWithdrawal(client, withdrawalId, {
      status: 'rejected',
      adminNotes: adminNotes != null ? String(adminNotes) : row.admin_notes,
      processedAt: new Date(),
    });

    await walletModel.insertFinancialAudit(client, {
      actorUserId: adminUserId,
      action: 'withdraw_reject',
      entityType: 'withdrawal',
      entityId: withdrawalId,
      details: { amount },
    });
    console.info('[wallet] withdraw_reject', { adminUserId, withdrawalId, amount });
    return { success: true, withdrawal: updated };
  });
}

export async function adminMarkWithdrawalPaid(adminUserId, withdrawalId) {
  return withTransaction(async (client) => {
    const row = await withdrawalModel.lockWithdrawalById(client, withdrawalId);
    if (!row) throw new AppError('Withdrawal not found', 404, 'NOT_FOUND');
    if (row.status !== 'approved') {
      throw new AppError('Only approved withdrawals can be marked paid', 400, 'INVALID_STATUS');
    }
    const updated = await withdrawalModel.updateWithdrawal(client, withdrawalId, {
      status: 'paid',
      processedAt: new Date(),
    });
    await walletModel.insertFinancialAudit(client, {
      actorUserId: adminUserId,
      action: 'withdraw_paid',
      entityType: 'withdrawal',
      entityId: withdrawalId,
      details: {},
    });
    console.info('[wallet] withdraw_paid', { adminUserId, withdrawalId });
    return { success: true, withdrawal: updated };
  });
}

export async function adminGetSellerWallet(sellerId) {
  const client = await pool.connect();
  try {
    await walletModel.ensureSellerWallet(client, sellerId);
    const w = await walletModel.getSellerWallet(client, sellerId);
    const tx = await walletModel.listWalletTransactionsForSeller(client, sellerId, {
      limit: 100,
      offset: 0,
    });
    return {
      success: true,
      seller_id: sellerId,
      wallet: formatWalletRow(w),
      transactions: tx.map(formatTxRow),
    };
  } finally {
    client.release();
  }
}

function formatLedgerAdminRow(row) {
  if (!row) return row;
  return {
    id: row.id,
    seller_id: row.seller_id,
    seller_email: row.seller_email ?? null,
    seller_name: row.seller_name ?? null,
    order_id: row.order_id,
    withdrawal_id: row.withdrawal_id,
    type: row.type,
    amount: money(row.amount),
    status: row.status,
    metadata: row.metadata,
    created_at: row.created_at,
    buyer_user_id: row.buyer_user_id ?? null,
    buyer_email: row.buyer_email ?? null,
    buyer_name: row.buyer_name ?? null,
    order_total: row.order_total != null ? money(row.order_total) : null,
    order_status: row.order_status != null ? String(row.order_status) : null,
  };
}

function formatAuditAdminRow(row) {
  if (!row) return row;
  return {
    id: row.id,
    actor_user_id: row.actor_user_id,
    actor_email: row.actor_email ?? null,
    actor_name: row.actor_name ?? null,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    details: row.details,
    created_at: row.created_at,
  };
}

function formatWithdrawalAdminDetail(row) {
  if (!row) return null;
  return {
    id: row.id,
    seller_id: row.seller_id,
    seller_email: row.seller_email ?? null,
    seller_name: row.seller_name ?? null,
    amount: money(row.amount),
    withdrawal_fee_amount:
      row.withdrawal_fee_amount != null ? money(row.withdrawal_fee_amount) : null,
    net_payout_amount: row.net_payout_amount != null ? money(row.net_payout_amount) : null,
    status: row.status,
    admin_notes: row.admin_notes,
    requested_at: row.requested_at,
    processed_at: row.processed_at,
    created_at: row.created_at,
    payout_bank_code: row.payout_bank_code ?? null,
    payout_account_name: row.payout_account_name ?? null,
    payout_account_number: row.payout_account_number
      ? String(row.payout_account_number).replace(/\s/g, '')
      : null,
  };
}

/** CMS — บัญชีแยกประเภท wallet (escrow / release / withdraw / refund) พร้อมบริบทออเดอร์ */
export async function adminListWalletLedger(query = {}) {
  const client = await pool.connect();
  try {
    const limit = Number(query.limit) || 50;
    const offset = Number(query.offset) || 0;
    const type = query.type ? String(query.type).trim() : '';
    const seller_id = query.seller_id ? String(query.seller_id).trim() : '';
    try {
      const rows = await walletModel.listWalletTransactionsAdmin(client, {
        limit,
        offset,
        type,
        seller_id,
      });
      const total = await walletModel.countWalletTransactionsAdmin(client, { type, seller_id });
      return {
        success: true,
        wallet_schema_incomplete: false,
        entries: rows.map(formatLedgerAdminRow),
        pagination: { limit, offset, total },
      };
    } catch (err) {
      if (!isWalletDashboardSchemaError(err)) throw err;
      console.warn('[wallet] admin ledger unavailable', err.code, err.message);
      return {
        success: true,
        wallet_schema_incomplete: true,
        entries: [],
        pagination: { limit, offset, total: 0 },
      };
    }
  } finally {
    client.release();
  }
}

/** CMS — financial_audit_logs */
export async function adminListFinancialAuditLogs(query = {}) {
  const client = await pool.connect();
  try {
    const limit = Number(query.limit) || 50;
    const offset = Number(query.offset) || 0;
    const action = query.action ? String(query.action).trim() : '';
    const entity_type = query.entity_type ? String(query.entity_type).trim() : '';
    try {
      const rows = await walletModel.listFinancialAuditLogsAdmin(client, {
        limit,
        offset,
        action,
        entity_type,
      });
      const total = await walletModel.countFinancialAuditLogsAdmin(client, { action, entity_type });
      return {
        success: true,
        wallet_schema_incomplete: false,
        entries: rows.map(formatAuditAdminRow),
        pagination: { limit, offset, total },
      };
    } catch (err) {
      if (!isWalletDashboardSchemaError(err)) throw err;
      console.warn('[wallet] admin audit log unavailable', err.code, err.message);
      return {
        success: true,
        wallet_schema_incomplete: true,
        entries: [],
        pagination: { limit, offset, total: 0 },
      };
    }
  } finally {
    client.release();
  }
}

/** CMS — รายละเอียดการถอน (เลขบัญชีเต็ม + ธุรกรรมที่เกี่ยวข้อง) */
export async function adminGetWithdrawalDetail(withdrawalId) {
  const client = await pool.connect();
  try {
    const row = await withdrawalModel.getWithdrawalWithSellerForAdmin(client, withdrawalId);
    if (!row) throw new AppError('Withdrawal not found', 404, 'NOT_FOUND');
    const related = await walletModel.listWalletTransactionsForWithdrawal(client, withdrawalId);
    return {
      success: true,
      withdrawal: formatWithdrawalAdminDetail(row),
      related_transactions: related.map(formatTxRow),
    };
  } finally {
    client.release();
  }
}
