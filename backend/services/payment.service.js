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

/** บรรทัดเดียว — grep `[payment-audit]` ใน Dokploy; เปิดด้วย PAYMENT_AUDIT_LOG=1 */
function paymentAudit(event, fields = {}) {
  if (!config.paymentAuditLog) return;
  try {
    console.info(
      '[payment-audit] ' +
        JSON.stringify({ ts: new Date().toISOString(), event, ...fields })
    );
  } catch {
    /* no-op */
  }
}

function trunc(s, n) {
  const t = String(s ?? '');
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

/** ไม่ส่งชื่อผู้โอน/รับเต็มลง log */
function redactSlipSummary(summary) {
  if (!summary || typeof summary !== 'object') return {};
  const transRef = summary.trans_ref != null ? String(summary.trans_ref) : '';
  return {
    verified: summary.verified === true,
    amount: summary.amount ?? null,
    date: summary.date ?? null,
    time: summary.time ?? null,
    bank_set: !!(summary.bank && String(summary.bank).trim()),
    trans_ref_tail: transRef ? transRef.slice(-8) : null,
  };
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

async function checkSlipWithSlipok(body, file, auditMeta = null) {
  if (!hasSlipokConfig()) {
    if (config.paymentAuditLog && auditMeta?.order_id) {
      paymentAudit('slipok_skip', {
        order_id: auditMeta.order_id,
        user_id: auditMeta.user_id,
        reason: 'SLIPOK_NOT_CONFIGURED',
      });
    }
    throw new AppError('SlipOK is not configured', 500, 'SLIPOK_NOT_CONFIGURED');
  }

  const picked = resolveSlipokPayload(body, file);
  if (!picked) {
    if (config.paymentAuditLog && auditMeta?.order_id) {
      paymentAudit('slipok_skip', {
        order_id: auditMeta.order_id,
        user_id: auditMeta.user_id,
        reason: 'VALIDATION_NO_SLIP_PAYLOAD',
      });
    }
    throw new AppError('Provide one of slip_data, slip_url, or slip_image file', 422, 'VALIDATION_ERROR');
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
  } catch (e) {
    if (config.paymentAuditLog && auditMeta?.order_id) {
      paymentAudit('slipok_fetch_error', {
        order_id: auditMeta.order_id,
        user_id: auditMeta.user_id,
        slip_mode: picked.mode,
        message: trunc(e?.message || e, 240),
      });
    }
    throw e;
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
    if (config.paymentAuditLog && auditMeta?.order_id) {
      paymentAudit('slipok_reject', {
        order_id: auditMeta.order_id,
        user_id: auditMeta.user_id,
        slip_mode: picked.mode,
        http_status: response.status,
        slipok_code: data?.code ?? null,
        app_code: code,
        message: trunc(msg, 240),
      });
    }
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
  return String(orderService.coerceOrderStatusText(row?.status) ?? '')
    .toLowerCase()
    .trim();
}

export async function mockPayment(userId, body, file) {
  const orderId = normalizeOrderIdForPayment(body.order_id);
  if (!orderId) {
    throw new AppError('order_id is required', 422, 'VALIDATION_ERROR');
  }
  const simulateFailure = parseBool(body.simulate_failure);
  const auditUser = String(userId);
  const slipAuditMeta = { order_id: orderId, user_id: auditUser };

  paymentAudit('mock_payment_enter', {
    order_id: orderId,
    user_id: auditUser,
    simulate_failure: simulateFailure,
    slip_input: file
      ? 'multipart'
      : String(body?.slip_url || '').trim()
        ? 'url'
        : String(body?.slip_data || '').trim()
          ? 'data'
          : 'none',
  });

  if (simulateFailure) {
    const sim = await withTransaction(async (client) => {
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
    paymentAudit('simulate_failure_done', {
      order_id: orderId,
      user_id: auditUser,
      order_status: sim?.order?.status ?? null,
      paid: false,
    });
    paymentAudit('mock_payment_exit', {
      order_id: orderId,
      user_id: auditUser,
      paid: false,
      already_paid: false,
      order_status: sim?.order?.status ?? null,
    });
    return sim;
  }

  /** อ่านสถานะก่อน — อย่าเปิด transaction ค้างระหว่าง SlipOK (HTTP ช้า) / PgBouncer อาจทำให้ commit กับ read ไม่สอดคล้อง */
  const reader = await pool.connect();
  let orderBefore;
  try {
    orderBefore = await orderModel.getOrderById(reader, orderId);
    if (!orderBefore) {
      paymentAudit('precheck_fail', {
        order_id: orderId,
        user_id: auditUser,
        reason: 'NOT_FOUND',
      });
      throw new AppError('Order not found', 404, 'NOT_FOUND');
    }
    if (String(orderBefore.user_id) !== String(userId)) {
      paymentAudit('precheck_fail', {
        order_id: orderId,
        user_id: auditUser,
        reason: 'FORBIDDEN',
      });
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }
    const st0 = orderStatusNorm(orderBefore);
    if (st0 === 'canceled') {
      paymentAudit('precheck_fail', {
        order_id: orderId,
        user_id: auditUser,
        reason: 'ORDER_CANCELED',
        status_before: st0,
      });
      throw new AppError('Order is canceled', 400, 'ORDER_CANCELED');
    }
    if (st0 === 'paid') {
      paymentAudit('already_paid_precheck', {
        order_id: orderId,
        user_id: auditUser,
        status_before: st0,
      });
      paymentAudit('mock_payment_exit', {
        order_id: orderId,
        user_id: auditUser,
        paid: true,
        already_paid: true,
        order_status: orderBefore?.status ?? null,
      });
      return {
        order: orderService.formatOrderForApi(orderBefore),
        paid: true,
        already_paid: true,
      };
    }
    paymentAudit('precheck_ok', {
      order_id: orderId,
      user_id: auditUser,
      status_before: st0,
    });
  } finally {
    reader.release();
  }

  const slipChecked = await checkSlipWithSlipok(body, file, slipAuditMeta);
  paymentAudit('slipok_passed', {
    order_id: orderId,
    user_id: auditUser,
    slip: redactSlipSummary(summarizeSlipokResult(slipChecked)),
  });

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
      paymentAudit('already_paid_in_tx', {
        order_id: orderId,
        user_id: auditUser,
        status_in_tx: st,
        slipok_ran: true,
      });
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
      paymentAudit('update_paid_failed', {
        order_id: orderId,
        user_id: auditUser,
        reason: 'NO_ROW_RETURNED',
        status_in_tx: st,
      });
      throw new AppError('Failed to set order as paid (no row updated)', 500, 'ORDER_UPDATE_FAILED');
    }

    paymentAudit('update_paid_ok', {
      order_id: orderId,
      user_id: auditUser,
      status_from: st,
      status_to: orderStatusNorm(updated),
      slip_image_set: !!(slipForOrderRow && String(slipForOrderRow).trim()),
    });

    try {
      await orderModel.insertOrderSlipSnapshot(client, {
        orderId,
        imageUrl: thisUploadUrl,
      });
    } catch (e) {
      paymentAudit('slip_snapshot_skipped', {
        order_id: orderId,
        user_id: auditUser,
        message: trunc(e?.message, 160),
      });
      /* ตาราง order_slip_snapshots ยังไม่ migrate — ไม่บล็อกการชำระ */
    }

    return {
      order: orderService.formatOrderForApi(updated),
      paid: true,
      slip: slipChecked,
      slip_verification: summarizeSlipokResult(slipChecked),
    };
  });

  paymentAudit('mock_payment_exit', {
    order_id: orderId,
    user_id: auditUser,
    paid: !!result?.paid,
    already_paid: !!result?.already_paid,
    order_status: result?.order?.status ?? null,
  });

  if (result?.paid === true && result?.order?.id) {
    notifyBuyerOrderPaid(userId, result.order.id).catch(() => {});
  }

  return result;
}
