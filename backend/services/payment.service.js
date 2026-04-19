import { AppError } from '../utils/AppError.js';
import { withTransaction } from '../models/db.js';
import * as orderModel from '../models/order.model.js';
import * as orderService from './order.service.js';
import * as sellerWalletService from './sellerWallet.service.js';
import { config } from '../config/index.js';
import fs from 'fs/promises';

function parseBool(v) {
  if (v === true || v === 'true' || v === '1') return true;
  return false;
}

function hasSlipokConfig() {
  return !!(config.slipok.branchId && config.slipok.apiKey);
}

function resolveSlipokPayload(body, file) {
  const slipData = String(body?.slip_data || '').trim();
  const slipUrl = String(body?.slip_url || '').trim();
  if (slipData) return { mode: 'data', value: slipData };
  if (file) return { mode: 'file', value: file };
  if (slipUrl) return { mode: 'url', value: slipUrl };
  return null;
}

/** SlipOK / ธนาคารบางแห่งแจ้งว่าต้องรอก่อนตรวจสลิปได้ (เช่น BBL ~7 นาที) */
function slipokFailureCodeFromMessage(msg) {
  const m = String(msg || '');
  if (
    /กรุงเทพ|ธนาคารกรุงเทพ|Bangkok\s*Bank|\bBBL\b|7\s*นาที|รอการตรวจสอบสลิป/i.test(m)
  ) {
    return 'SLIP_BANK_DELAY';
  }
  return 'SLIP_INVALID';
}

function slipokErrorMessage(data) {
  const d = data && typeof data === 'object' ? data : {};
  return (
    d.message ||
    d.data?.message ||
    d.data?.error?.message ||
    d.data?.data?.message ||
    d.error?.message ||
    d.errors?.[0]?.message ||
    (typeof d.data === 'string' ? d.data : '') ||
    'Slip verification failed'
  );
}

async function checkSlipWithSlipok(body, file) {
  if (!hasSlipokConfig()) {
    throw new AppError('SlipOK is not configured on this server', 503, 'SLIPOK_NOT_CONFIGURED');
  }

  const picked = resolveSlipokPayload(body, file);
  if (!picked) {
    throw new AppError('Please upload your payment slip file (slip_image).', 422, 'FILE_REQUIRED');
  }

  const base = String(config.slipok.apiBase || 'https://api.slipok.com').replace(/\/$/, '');
  const url = `${base}/api/line/apikey/${config.slipok.branchId}`;
  const headers = { 'x-authorization': config.slipok.apiKey };
  const amount = body?.amount != null && body.amount !== '' ? Number(body.amount) : undefined;
  const log = body?.log !== undefined ? parseBool(body.log) : parseBool(config.slipok.defaultLog);

  let response;
  try {
    if (picked.mode === 'file') {
      const fd = new FormData();
      let buf;
      try {
        buf = await fs.readFile(picked.value.path);
      } catch (e) {
        console.error('[payment] read slip file failed', picked.value?.path, e?.message);
        throw new AppError('Could not read the uploaded slip file', 400, 'SLIP_FILE_READ_FAILED');
      }
      const mime = picked.value.mimetype || 'application/octet-stream';
      fd.append('files', new Blob([buf], { type: mime }), picked.value.originalname || 'slip.png');
      fd.append('log', String(log));
      if (amount !== undefined && Number.isFinite(amount)) {
        fd.append('amount', String(amount));
      }
      response = await fetch(url, { method: 'POST', headers, body: fd });
    } else {
      const payload = { log };
      if (picked.mode === 'data') payload.data = picked.value;
      if (picked.mode === 'url') payload.url = picked.value;
      if (amount !== undefined && Number.isFinite(amount)) payload.amount = amount;
      response = await fetch(url, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
  } catch (e) {
    if (e instanceof AppError) throw e;
    console.error('[payment] SlipOK request failed', e?.code, e?.message);
    throw new AppError('Could not reach slip verification service. Please try again.', 502, 'SLIPOK_UNREACHABLE');
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    /* no-op */
  }
  if (!response.ok || !data?.success || !data?.data?.success) {
    const msg = slipokErrorMessage(data);
    const code = slipokFailureCodeFromMessage(msg);
    console.warn('[payment] SlipOK verify failed', {
      httpStatus: response.status,
      code,
      message: String(msg).slice(0, 500),
    });
    throw new AppError(String(msg), 400, code);
  }
  return data.data;
}

export async function getSlipokQuota() {
  if (!hasSlipokConfig()) {
    throw new AppError('SlipOK is not configured on this server', 503, 'SLIPOK_NOT_CONFIGURED');
  }
  const base = String(config.slipok.apiBase || 'https://api.slipok.com').replace(/\/$/, '');
  const url = `${base}/api/line/apikey/${config.slipok.branchId}/quota`;
  const response = await fetch(url, {
    headers: { 'x-authorization': config.slipok.apiKey },
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    /* no-op */
  }
  if (!response.ok || !data?.success || !data?.data) {
    throw new AppError('Cannot fetch SlipOK quota', 400, 'SLIPOK_QUOTA_ERROR');
  }
  return { quota: data.data };
}

function normalizeOrderIdForPayment(orderId) {
  return String(orderId ?? '').trim();
}

function orderStatusNorm(row) {
  return String(row?.status ?? '')
    .toLowerCase()
    .trim();
}

export async function mockPayment(userId, body, file) {
  const orderId = body.order_id;
  const simulateFailure = parseBool(body.simulate_failure);

  return withTransaction(async (client) => {
    const order = await orderModel.getOrderById(client, orderId);
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
    if (order.user_id !== userId) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }

    if (simulateFailure) {
      await orderService.restoreStockForOrder(client, orderId);
      const updated = await orderModel.updateOrderStatus(client, orderId, 'payment_failed');
      return { order: updated, paid: false };
    }

    const slipChecked = await checkSlipWithSlipok(body, file);
    const slipUrl = file ? `/uploads/${file.filename}` : null;
    const updated = await orderModel.updateOrderStatus(client, orderId, 'paid', {
      slipImageUrl: slipUrl,
    });
    await client.query('SAVEPOINT payment_wallet_escrow');
    try {
      await sellerWalletService.recordEscrowForPaidOrder(client, orderId);
      await client.query('RELEASE SAVEPOINT payment_wallet_escrow');
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT payment_wallet_escrow');
      const walletSkippable =
        sellerWalletService.isWalletDashboardSchemaError(err) ||
        (err instanceof AppError && err.code === 'WALLET_UPDATE_FAILED');
      if (!walletSkippable) throw err;
      console.warn('[payment] mockPayment: escrow skipped', orderId, err?.code, err?.message);
    }
    return { order: updated, paid: true, slip: slipChecked };
  }).then((result) => {
    if (result.paid && orderId) {
      void import('./fcmOrderNotify.service.js').then(({ notifySellersOrderPaid }) =>
        notifySellersOrderPaid(orderId).catch((e) => {
          console.warn('[fcm] notifySellersOrderPaid:', e?.message || e);
        })
      );
    }
    return result;
  });
}
