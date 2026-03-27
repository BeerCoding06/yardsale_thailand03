import { AppError } from '../utils/AppError.js';
import { withTransaction } from '../models/db.js';
import * as orderModel from '../models/order.model.js';
import * as orderService from './order.service.js';
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
  return (
    data?.message ||
    data?.data?.message ||
    data?.data?.error?.message ||
    data?.error?.message ||
    'Slip verification failed'
  );
}

async function checkSlipWithSlipok(body, file) {
  if (!hasSlipokConfig()) {
    throw new AppError('SlipOK is not configured', 500, 'SLIPOK_NOT_CONFIGURED');
  }

  const picked = resolveSlipokPayload(body, file);
  if (!picked) {
    throw new AppError('Provide one of slip_data, slip_url, or slip_image file', 422, 'VALIDATION_ERROR');
  }

  const base = String(config.slipok.apiBase || 'https://api.slipok.com').replace(/\/$/, '');
  const url = `${base}/api/line/apikey/${config.slipok.branchId}`;
  const headers = { 'x-authorization': config.slipok.apiKey };
  const amount = body?.amount != null && body.amount !== '' ? Number(body.amount) : undefined;
  const log = body?.log !== undefined ? parseBool(body.log) : parseBool(config.slipok.defaultLog);

  let response;
  if (picked.mode === 'file') {
    const fd = new FormData();
    const buf = await fs.readFile(picked.value.path);
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

  let data = null;
  try {
    data = await response.json();
  } catch {
    /* no-op */
  }
  if (!response.ok || !data?.success || !data?.data?.success) {
    const msg = slipokErrorMessage(data);
    const code = slipokFailureCodeFromMessage(msg);
    throw new AppError(String(msg), 400, code);
  }
  return data.data;
}

export async function getSlipokQuota() {
  if (!hasSlipokConfig()) {
    throw new AppError('SlipOK is not configured', 500, 'SLIPOK_NOT_CONFIGURED');
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
    return { order: updated, paid: true, slip: slipChecked };
  });
}
