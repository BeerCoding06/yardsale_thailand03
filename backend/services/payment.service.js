import { AppError } from '../utils/AppError.js';
import { withTransaction, pool } from '../models/db.js';
import * as orderModel from '../models/order.model.js';
import * as orderService from './order.service.js';
import { notifyBuyerOrderPaid } from './fcmOrderNotify.service.js';
import { config } from '../config/index.js';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function uploadsAbsoluteDir() {
  return path.isAbsolute(config.uploadDir)
    ? config.uploadDir
    : path.resolve(path.join(__dirname, '..'), config.uploadDir);
}

/**
 * URL สำหรับ orders.slip_image_url / order_slip_snapshots — ไฟล์, ลิงก์ภายนอก, หรือ data:image base64
 */
async function resolveSlipImageUrlForPayment(orderId, body, file) {
  if (file?.filename) {
    return `/uploads/${file.filename}`;
  }
  const extUrl = String(body?.slip_url || '').trim();
  if (extUrl) return extUrl;

  const slipData = String(body?.slip_data || '').trim();
  if (!slipData) return null;

  const m = slipData.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
  if (!m) return null;

  const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
  let buf;
  try {
    buf = Buffer.from(m[2], 'base64');
  } catch {
    return null;
  }
  if (!buf.length) return null;

  const dir = uploadsAbsoluteDir();
  if (!fsSync.existsSync(dir)) {
    fsSync.mkdirSync(dir, { recursive: true });
  }
  const name = `slip-${orderId}-${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
  await fs.writeFile(path.join(dir, name), buf);
  return `/uploads/${name}`;
}

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

function pickSlipokField(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim() !== '') return v;
  }
  return null;
}

/** สรุปผล SlipOK ส่งให้ client — ไม่ส่ง payload ดิบทั้งก้อน */
function summarizeSlipokResult(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { verified: false };
  }
  return {
    verified: true,
    amount: pickSlipokField(raw, ['amount', 'Amount', 'transAmount', 'value']),
    date: pickSlipokField(raw, ['date', 'Date', 'transDate', 'trans_date']),
    time: pickSlipokField(raw, ['time', 'Time', 'transTime', 'trans_time']),
    sender: pickSlipokField(raw, ['sender', 'Sender', 'senderName', 'customerName', 'name']),
    receiver: pickSlipokField(raw, ['receiver', 'Receiver', 'receiveAccount', 'receiverName']),
    bank: pickSlipokField(raw, ['bank', 'Bank', 'senderBank', 'sendingBank', 'bankName']),
    trans_ref: pickSlipokField(raw, ['transRef', 'trans_ref', 'ref', 'reference']),
  };
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
  // SlipOK ตอบแบบ { success, data, message?, code? } — ไม่มี field data.success เสมอไป (ดู slipok-sdk)
  const slipPayload = data?.data;
  const nestedFail =
    slipPayload != null &&
    typeof slipPayload.success === 'boolean' &&
    slipPayload.success === false;
  if (
    !response.ok ||
    !data?.success ||
    slipPayload == null ||
    data?.code != null ||
    nestedFail
  ) {
    const msg = slipokErrorMessage(data);
    const code = slipokFailureCodeFromMessage(msg);
    throw new AppError(String(msg), 400, code);
  }
  return slipPayload;
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

function normalizeOrderIdForPayment(orderId) {
  return String(orderId ?? '').trim();
}

function orderStatusNorm(row) {
  return String(row?.status ?? '')
    .toLowerCase()
    .trim();
}

export async function mockPayment(userId, body, file) {
  const orderId = normalizeOrderIdForPayment(body.order_id);
  if (!orderId) {
    throw new AppError('order_id is required', 422, 'VALIDATION_ERROR');
  }
  const simulateFailure = parseBool(body.simulate_failure);

  if (simulateFailure) {
    return withTransaction(async (client) => {
      const order = await orderModel.getOrderById(client, orderId);
      if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
      if (String(order.user_id) !== String(userId)) {
        throw new AppError('Forbidden', 403, 'FORBIDDEN');
      }
      await orderService.restoreStockForOrder(client, orderId);
      const updated = await orderModel.updateOrderStatus(client, orderId, 'payment_failed');
      if (!updated) {
        throw new AppError('Failed to update order', 500, 'ORDER_UPDATE_FAILED');
      }
      return { order: orderService.formatOrderForApi(updated), paid: false };
    });
  }

  /** อ่านสถานะก่อน — อย่าเปิด transaction ค้างระหว่าง SlipOK (HTTP ช้า) / PgBouncer อาจทำให้ commit กับ read ไม่สอดคล้อง */
  const reader = await pool.connect();
  let orderBefore;
  try {
    orderBefore = await orderModel.getOrderById(reader, orderId);
    if (!orderBefore) throw new AppError('Order not found', 404, 'NOT_FOUND');
    if (String(orderBefore.user_id) !== String(userId)) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }
    const st0 = orderStatusNorm(orderBefore);
    if (st0 === 'canceled') {
      throw new AppError('Order is canceled', 400, 'ORDER_CANCELED');
    }
    if (st0 === 'paid') {
      return {
        order: orderService.formatOrderForApi(orderBefore),
        paid: true,
        already_paid: true,
      };
    }
  } finally {
    reader.release();
  }

  const slipChecked = await checkSlipWithSlipok(body, file);
  const thisUploadUrl = await resolveSlipImageUrlForPayment(orderId, body, file);
  const slipForOrderRow =
    thisUploadUrl != null && String(thisUploadUrl).trim() !== ''
      ? String(thisUploadUrl).trim()
      : orderBefore.slip_image_url || null;

  const result = await withTransaction(async (client) => {
    const order = await orderModel.getOrderById(client, orderId);
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
    if (String(order.user_id) !== String(userId)) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }
    const st = orderStatusNorm(order);
    if (st === 'canceled') {
      throw new AppError('Order is canceled', 400, 'ORDER_CANCELED');
    }
    if (st === 'paid') {
      return {
        order: orderService.formatOrderForApi(order),
        paid: true,
        already_paid: true,
        slip: slipChecked,
        slip_verification: summarizeSlipokResult(slipChecked),
      };
    }

    const updated = await orderModel.updateOrderStatus(client, orderId, 'paid', {
      slipImageUrl: slipForOrderRow,
    });
    if (!updated) {
      throw new AppError('Failed to set order as paid (no row updated)', 500, 'ORDER_UPDATE_FAILED');
    }

    try {
      await orderModel.insertOrderSlipSnapshot(client, {
        orderId,
        imageUrl: thisUploadUrl,
      });
    } catch {
      /* ตาราง order_slip_snapshots ยังไม่ migrate — ไม่บล็อกการชำระ */
    }

    return {
      order: orderService.formatOrderForApi(updated),
      paid: true,
      slip: slipChecked,
      slip_verification: summarizeSlipokResult(slipChecked),
    };
  });

  if (result?.paid === true && result?.order?.id) {
    notifyBuyerOrderPaid(userId, result.order.id).catch(() => {});
  }

  return result;
}
