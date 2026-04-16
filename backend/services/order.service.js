import { AppError } from '../utils/AppError.js';
import { paginationMeta } from '../utils/pagination.js';
import { withTransaction, pool } from '../models/db.js';
import * as productModel from '../models/product.model.js';
import * as orderModel from '../models/order.model.js';
import * as cartModel from '../models/cart.model.js';
import * as seventeenTrack from './seventeenTrack.service.js';
import * as trackingLogModel from '../models/trackingLog.model.js';
import { notifyBuyerOrderPaid, notifySellersNewOrder } from './fcmOrderNotify.service.js';

function aggregateLineItems(lineItems) {
  const map = new Map();
  for (const li of lineItems) {
    const q = map.get(li.product_id) || 0;
    map.set(li.product_id, q + li.quantity);
  }
  return [...map.entries()].map(([product_id, quantity]) => ({ product_id, quantity }));
}

/** จาก checkout (camelCase / snake ได้) */
function normalizeBillingFromPayload(b) {
  if (!b || typeof b !== 'object') return null;
  const out = {
    email: String(b.email || b.user_email || '').trim() || null,
    first_name: String(b.firstName || b.first_name || '').trim(),
    last_name: String(b.lastName || b.last_name || '').trim(),
    phone: String(b.phone || '').trim(),
    address_1: String(b.address1 || b.address_1 || '').trim(),
    address_2: String(b.address2 || b.address_2 || '').trim(),
    city: String(b.city || '').trim(),
    state: String(b.state || '').trim(),
    postcode: String(b.postcode || '').trim(),
    country: String(b.country || 'TH').trim() || 'TH',
  };
  const has = Object.values(out).some((v) => v != null && String(v).length > 0);
  return has ? out : null;
}

function parseBillingSnapshot(row) {
  if (!row) return null;
  let snap = row.billing_snapshot;
  if (snap == null) return null;
  if (typeof snap === 'string') {
    try {
      snap = JSON.parse(snap);
    } catch {
      return null;
    }
  }
  return typeof snap === 'object' && snap ? snap : null;
}

/** แปลงแถว DB → API (billing, aliases) */
export function formatOrderForApi(row) {
  if (!row) return row;
  const snap = parseBillingSnapshot(row);
  let billing = null;
  if (snap) {
    billing = {
      email: snap.email || '',
      first_name: snap.first_name || '',
      last_name: snap.last_name || '',
      phone: snap.phone || '',
      address_1: snap.address_1 || '',
      address_2: snap.address_2 || '',
      city: snap.city || '',
      state: snap.state || '',
      postcode: snap.postcode || '',
      country: snap.country || 'TH',
    };
  }
  const statusStr = row.status != null ? String(row.status) : '';
  const st = String(statusStr)
    .toLowerCase()
    .trim()
    .replace(/-/g, '_');
  /** สอดคล้องกับ customerPaymentUiKey — ออเดอร์ที่ชำระแล้วอาจเป็น paid / processing / completed ฯลฯ */
  const isPaidFlag =
    st === 'paid' ||
    st === 'processing' ||
    st === 'completed' ||
    st === 'refunded' ||
    st === 'partially_refunded';
  return {
    ...row,
    /** บังคับเป็น string — กันบาง proxy/driver ส่ง enum แปลก ๆ */
    status: statusStr || row.status,
    billing,
    date_created: row.created_at,
    total: row.total_price,
    shipping_status: row.shipping_status || 'pending',
    is_paid: isPaidFlag,
  };
}

export async function restoreStockForOrder(client, orderId) {
  const items = await orderModel.getOrderItems(client, orderId);
  for (const it of items) {
    await productModel.incrementProductStock(client, it.product_id, it.quantity);
  }
}

/**
 * Create order: single transaction, FOR UPDATE on products, deduct stock, insert order + items.
 * @param {object} payload — { line_items, billing? }
 */
export async function createOrder(userId, payload) {
  const lineItemsRaw = payload?.line_items;
  const lineItems = aggregateLineItems(Array.isArray(lineItemsRaw) ? lineItemsRaw : []);
  if (!lineItems.length) {
    throw new AppError('No line items', 400, 'EMPTY_CART');
  }

  const billingSnap = normalizeBillingFromPayload(payload?.billing);

  return withTransaction(async (client) => {
    const productIds = lineItems.map((l) => l.product_id);
    const locked = await productModel.lockProductsForUpdate(client, productIds);
    const byId = new Map(locked.map((r) => [r.id, r]));

    for (const line of lineItems) {
      const row = byId.get(line.product_id);
      if (!row) {
        throw new AppError(`Product not found: ${line.product_id}`, 404, 'NOT_FOUND');
      }
      if (
        row.is_cancelled ||
        (row.listing_status != null && row.listing_status !== 'published')
      ) {
        throw new AppError(`Product unavailable: ${line.product_id}`, 400, 'UNAVAILABLE');
      }
      if (row.stock < line.quantity) {
        throw new AppError(
          `Insufficient stock for ${row.name} (have ${row.stock}, need ${line.quantity})`,
          400,
          'INSUFFICIENT_STOCK'
        );
      }
    }

    let total = 0;
    const pricedLines = [];
    for (const line of lineItems) {
      const row = byId.get(line.product_id);
      const price = Number(row.price);
      total += price * line.quantity;
      const ok = await productModel.decrementProductStock(client, line.product_id, line.quantity);
      if (!ok) {
        throw new AppError(`Stock race for product ${line.product_id}`, 409, 'STOCK_RACE');
      }
      pricedLines.push({
        product_id: line.product_id,
        quantity: line.quantity,
        price,
      });
    }

    const order = await orderModel.createOrderRow(client, {
      userId,
      totalPrice: Number(total.toFixed(2)),
      status: 'pending',
      billingSnapshot: billingSnap,
    });
    await orderModel.insertOrderItems(client, order.id, pricedLines);

    const cartId = await cartModel.getOrCreateCart(client, userId);
    await cartModel.clearCart(client, cartId);

    const items = await orderModel.getOrderItems(client, order.id);
    return { order: { ...formatOrderForApi(order), line_items: items } };
  }).then((payload) => {
    notifySellersNewOrder(payload.order.id).catch(() => {});
    return payload;
  });
}

export async function getOrder(orderId, userId, role) {
  const client = await pool.connect();
  try {
    const order = await orderModel.getOrderById(client, orderId);
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
    if (order.user_id !== userId && role !== 'admin') {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }
    const items = await orderModel.getOrderItems(client, orderId);
    return { order: { ...formatOrderForApi(order), line_items: items } };
  } finally {
    client.release();
  }
}

export async function listMyOrders(userId, { page, pageSize, offset, search } = {}) {
  const client = await pool.connect();
  try {
    const total = await orderModel.countOrdersForUser(client, userId, search);
    const rows = await orderModel.listOrdersForUserPaged(client, userId, {
      limit: pageSize,
      offset,
      search,
    });
    const ids = rows.map((o) => o.id);
    const lineMap = await orderModel.mapLineItemsByOrderIds(client, ids);
    return {
      orders: rows.map((row) => ({
        ...formatOrderForApi(row),
        line_items: lineMap.get(row.id) || [],
      })),
      pagination: paginationMeta({ page, pageSize, total }),
    };
  } finally {
    client.release();
  }
}

export async function listSellerOrders(sellerId, { page, pageSize, offset, search } = {}) {
  const client = await pool.connect();
  try {
    const total = await orderModel.countOrdersForSeller(client, sellerId, search);
    const orders = await orderModel.listOrdersForSellerPaged(client, sellerId, {
      limit: pageSize,
      offset,
      search,
    });
    const ids = orders.map((o) => o.id);
    const lineMap = await orderModel.mapSellerLineItemsByOrderIds(client, sellerId, ids);
    let snapMap = new Map();
    try {
      snapMap = await orderModel.mapSlipSnapshotsByOrderIds(client, ids);
    } catch {
      /* order_slip_snapshots ยังไม่มีในฐานข้อมูล */
    }
    return {
      orders: orders.map((row) => ({
        ...formatOrderForApi(row),
        line_items: lineMap.get(row.id) || [],
        slip_snapshots: snapMap.get(row.id) || [],
      })),
      pagination: paginationMeta({ page, pageSize, total }),
    };
  } finally {
    client.release();
  }
}

export async function listAllOrdersAdmin({ page, pageSize, offset, search } = {}) {
  const client = await pool.connect();
  try {
    const total = await orderModel.countAllOrders(client, search);
    const orders = await orderModel.listAllOrdersPaged(client, {
      limit: pageSize,
      offset,
      search,
    });
    const ids = orders.map((o) => o.id);
    const lineMap = await orderModel.mapLineItemsByOrderIds(client, ids);
    let snapMap = new Map();
    try {
      snapMap = await orderModel.mapSlipSnapshotsByOrderIds(client, ids);
    } catch {
      /* order_slip_snapshots ยังไม่มีในฐานข้อมูล */
    }
    return {
      orders: orders.map((row) => ({
        ...formatOrderForApi(row),
        line_items: lineMap.get(row.id) || [],
        slip_snapshots: snapMap.get(row.id) || [],
      })),
      pagination: paginationMeta({ page, pageSize, total }),
    };
  } finally {
    client.release();
  }
}

const FULFILLMENT_STATUSES = new Set([
  'pending',
  'preparing',
  'shipped',
  'out_for_delivery',
  'delivered',
]);

function normalizeFulfillmentStatus(s) {
  const v = String(s || 'pending')
    .toLowerCase()
    .trim()
    .replace(/-/g, '_');
  return FULFILLMENT_STATUSES.has(v) ? v : 'pending';
}

/** ผู้ขายกรอกเลข Tracking — 17TRACK ถ้ามี key. แอดมินแก้ทุกออเดอร์ได้ + ตั้ง shipping_status/courier เอง */
export async function updateSellerOrderFulfillment(userId, orderId, body, role) {
  const client = await pool.connect();
  try {
    const order = await orderModel.getOrderById(client, orderId);
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');

    const isAdmin = role === 'admin';
    if (!isAdmin) {
      const ok = await orderModel.orderHasSellerProduct(client, orderId, userId);
      if (!ok) throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }

    if (isAdmin) {
      let tn =
        body.tracking_number !== undefined
          ? String(body.tracking_number ?? '').trim()
          : String(order.tracking_number || '').trim();
      let courier_name =
        body.courier_name !== undefined
          ? String(body.courier_name ?? '').trim()
          : String(order.courier_name || '').trim();
      let shipping_receipt_number =
        body.shipping_receipt_number !== undefined
          ? String(body.shipping_receipt_number ?? '').trim()
          : String(order.shipping_receipt_number || '').trim();
      let shipping_status = normalizeFulfillmentStatus(
        body.shipping_status !== undefined ? body.shipping_status : order.shipping_status
      );

      if (tn) {
        const resolved = await seventeenTrack.tryResolveTrackingForFulfillment(tn, body.carrier);
        if (resolved) {
          if (body.shipping_status === undefined) {
            shipping_status = seventeenTrack.mapNormalizedToShippingStatus(resolved.normalized);
          }
          if (body.courier_name === undefined) {
            const fromTrack = resolved.normalized.carrier || '';
            if (fromTrack) courier_name = fromTrack;
          }
          try {
            await trackingLogModel.insertTrackingLog(client, {
              trackingNumber: resolved.normalized.trackingNumber,
              carrier: resolved.normalized.carrier,
              status: resolved.normalized.currentStatus,
              rawResponse: resolved.upstream,
            });
          } catch {
            /* noop */
          }
        } else if (body.shipping_status === undefined) {
          shipping_status = 'shipped';
        }
      } else {
        if (body.courier_name === undefined) courier_name = '';
        if (body.shipping_receipt_number === undefined) shipping_receipt_number = '';
        if (body.shipping_status === undefined) shipping_status = 'pending';
      }

      const updated = await orderModel.updateOrderFulfillment(client, orderId, {
        shipping_status,
        tracking_number: tn,
        shipping_receipt_number,
        courier_name,
      });
      return { order: formatOrderForApi(updated) };
    }

    const tn = String(body.tracking_number ?? '').trim();
    let shipping_status = 'pending';
    let courier_name = String(body.courier_name ?? '').trim();
    let shipping_receipt_number = String(body.shipping_receipt_number ?? '').trim();

    if (tn) {
      const resolved = await seventeenTrack.tryResolveTrackingForFulfillment(tn, body.carrier);
      if (resolved) {
        shipping_status = seventeenTrack.mapNormalizedToShippingStatus(resolved.normalized);
        if (!courier_name) {
          courier_name = resolved.normalized.carrier || '';
        }
        try {
          await trackingLogModel.insertTrackingLog(client, {
            trackingNumber: resolved.normalized.trackingNumber,
            carrier: resolved.normalized.carrier,
            status: resolved.normalized.currentStatus,
            rawResponse: resolved.upstream,
          });
        } catch {
          /* tracking_logs ไม่มีหรือ insert ล้ม — ไม่บล็อก fulfillment */
        }
      } else {
        shipping_status = 'shipped';
      }
    } else {
      courier_name = '';
      shipping_receipt_number = '';
    }

    const updated = await orderModel.updateOrderFulfillment(client, orderId, {
      shipping_status,
      tracking_number: tn,
      shipping_receipt_number,
      courier_name,
    });
    return { order: formatOrderForApi(updated) };
  } finally {
    client.release();
  }
}

/**
 * แอดมินยืนยันรับชำระเงิน — ใช้เมื่อ SlipOK/อัปโหลดสลิปอัตโนมัติไม่สำเร็จแต่ลูกค้าโอนจริง
 * @param {string} orderId
 * @param {{ slipImageUrl?: string }} [opts]
 */
export async function markOrderPaidAsAdmin(orderId, { slipImageUrl } = {}) {
  const id = String(orderId ?? '').trim();
  const payload = await withTransaction(async (client) => {
    const order = await orderModel.getOrderById(client, id);
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
    const st = String(order.status || '').toLowerCase();
    if (st === 'canceled') {
      throw new AppError('Cannot mark canceled order as paid', 400, 'BAD_STATUS');
    }
    if (st === 'paid') {
      return { order: formatOrderForApi(order), alreadyPaid: true };
    }
    const slip =
      slipImageUrl != null && String(slipImageUrl).trim() !== ''
        ? String(slipImageUrl).trim()
        : order.slip_image_url || null;
    const updated = await orderModel.updateOrderStatus(client, id, 'paid', {
      slipImageUrl: slip,
    });
    if (!updated) throw new AppError('Failed to update order', 500, 'ORDER_UPDATE_FAILED');
    return { order: formatOrderForApi(updated), alreadyPaid: false };
  });
  if (!payload.alreadyPaid && payload.order?.user_id && payload.order?.id) {
    notifyBuyerOrderPaid(payload.order.user_id, payload.order.id).catch(() => {});
  }
  return payload;
}

/**
 * Cancel order and restore inventory (safe for pending / paid / payment_failed — not already canceled).
 */
export async function cancelOrder(orderId, userId, role) {
  return withTransaction(async (client) => {
    const order = await orderModel.getOrderById(client, orderId);
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
    if (order.user_id !== userId && role !== 'admin') {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }
    if (order.status === 'canceled') {
      return { order: formatOrderForApi(order), alreadyCanceled: true };
    }

    if (order.status === 'payment_failed') {
      const updated = await orderModel.updateOrderStatus(client, orderId, 'canceled');
      return { order: formatOrderForApi(updated) };
    }

    await restoreStockForOrder(client, orderId);
    const updated = await orderModel.updateOrderStatus(client, orderId, 'canceled');
    return { order: formatOrderForApi(updated) };
  });
}
