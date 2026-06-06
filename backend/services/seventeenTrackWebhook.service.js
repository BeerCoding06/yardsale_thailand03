import crypto from 'crypto';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import { withTransaction, pool } from '../models/db.js';
import * as orderModel from '../models/order.model.js';
import * as trackingLogModel from '../models/trackingLog.model.js';
import * as sellerWalletService from './sellerWallet.service.js';
import {
  normalizeAcceptedItem,
  mapNormalizedToShippingStatus,
} from './seventeenTrack.service.js';

/**
 * 17TRACK webhook signature: SHA256(rawBody + "/" + apiKey) hex
 * @param {string} rawBody
 * @param {string | undefined} signHeader
 */
export function verifyWebhookSignature(rawBody, signHeader) {
  const key = config.seventeenTrack.apiKey;
  if (!key) {
    throw new AppError('17TRACK is not configured', 503, 'TRACKING_NOT_CONFIGURED');
  }
  if (config.seventeenTrack.webhookSkipVerify) return true;

  const expected = String(signHeader || '').trim().toLowerCase();
  if (!expected) {
    throw new AppError('Missing 17TRACK webhook signature', 401, 'WEBHOOK_SIGNATURE_MISSING');
  }

  const src = `${rawBody}/${key}`;
  const hash = crypto.createHash('sha256').update(src, 'utf8').digest('hex');
  const ok =
    hash.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(hash, 'utf8'), Buffer.from(expected, 'utf8'));
  if (!ok) {
    throw new AppError('Invalid 17TRACK webhook signature', 401, 'WEBHOOK_SIGNATURE_INVALID');
  }
  return true;
}

/**
 * @param {object} body
 */
export async function processWebhookBody(body) {
  const event = String(body?.event || '').trim();
  const data = body?.data;

  if (event === 'TRACKING_STOPPED') {
    const tn = String(data?.number || '').trim();
    return { event, trackingNumber: tn, updatedOrders: 0, skipped: 'tracking_stopped' };
  }

  if (event !== 'TRACKING_UPDATED' || !data || typeof data !== 'object') {
    return { event: event || 'unknown', updatedOrders: 0, skipped: 'unsupported_event' };
  }

  const normalized = normalizeAcceptedItem(data);
  const tn = normalized.trackingNumber;
  if (!tn) {
    return { event, updatedOrders: 0, skipped: 'missing_tracking_number' };
  }

  const shippingStatus = mapNormalizedToShippingStatus(normalized);
  const carrierName = normalized.carrier || null;
  const statusText = normalized.currentStatus || shippingStatus;

  let updatedOrders = 0;
  const orderIds = [];

  await withTransaction(async (client) => {
    try {
      await trackingLogModel.insertTrackingLog(client, {
        trackingNumber: tn,
        carrier: carrierName,
        status: statusText,
        rawResponse: body,
      });
    } catch (e) {
      const code = e?.code;
      if (code !== '42P01' && code !== '42703') throw e;
    }

    const orders = await orderModel.listPaidOrdersByTrackingNumber(client, tn);
    for (const order of orders) {
      const nextCourier =
        String(order.courier_name || '').trim() || (carrierName ? String(carrierName).trim() : '');

      const updated = await orderModel.updateOrderFulfillment(client, order.id, {
        shipping_status: shippingStatus,
        tracking_number: tn,
        shipping_receipt_number: order.shipping_receipt_number ?? '',
        courier_name: nextCourier,
      });

      if (updated && sellerWalletService.isPhysicallyDelivered(updated)) {
        await orderModel.touchDeliveredAtIfUnset(client, order.id);
      }

      updatedOrders += 1;
      orderIds.push(order.id);
    }
  });

  return {
    event,
    trackingNumber: tn,
    shippingStatus,
    currentStatus: statusText,
    updatedOrders,
    orderIds,
  };
}

/**
 * @param {{ rawBody: string, signHeader?: string }} input
 */
export async function processWebhookRequest({ rawBody, signHeader }) {
  verifyWebhookSignature(rawBody, signHeader);

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new AppError('Invalid JSON body', 400, 'WEBHOOK_INVALID_JSON');
  }

  return processWebhookBody(body);
}

/** Health / dashboard test — 17TRACK expects HTTP 200 */
export function pingResponse() {
  return { ok: true, service: '17track-webhook' };
}
