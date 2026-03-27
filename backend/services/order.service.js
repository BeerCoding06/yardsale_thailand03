import { AppError } from '../utils/AppError.js';
import { withTransaction, pool } from '../models/db.js';
import * as productModel from '../models/product.model.js';
import * as orderModel from '../models/order.model.js';
import * as cartModel from '../models/cart.model.js';

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
  return {
    ...row,
    billing,
    date_created: row.created_at,
    total: row.total_price,
    shipping_status: row.shipping_status || 'pending',
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

export async function listMyOrders(userId) {
  const client = await pool.connect();
  try {
    const orders = await orderModel.listOrdersForUser(client, userId);
    return { orders: orders.map(formatOrderForApi) };
  } finally {
    client.release();
  }
}

export async function listSellerOrders(sellerId) {
  const client = await pool.connect();
  try {
    const orders = await orderModel.listOrdersForSeller(client, sellerId);
    return { orders: orders.map(formatOrderForApi) };
  } finally {
    client.release();
  }
}

export async function listAllOrdersAdmin() {
  const client = await pool.connect();
  try {
    const orders = await orderModel.listAllOrders(client);
    return { orders: orders.map(formatOrderForApi) };
  } finally {
    client.release();
  }
}

/** ผู้ขายอัปเดตไทม์ไลน์จัดส่ง + เลขพัสดุ / ใบเสร็จขนส่ง */
export async function updateSellerOrderFulfillment(userId, role, orderId, body) {
  const client = await pool.connect();
  try {
    const order = await orderModel.getOrderById(client, orderId);
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
    if (role !== 'admin') {
      const ok = await orderModel.orderHasSellerProduct(client, orderId, userId);
      if (!ok) throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }
    const updated = await orderModel.updateOrderFulfillment(client, orderId, {
      shipping_status: body.shipping_status,
      tracking_number: body.tracking_number ?? '',
      shipping_receipt_number: body.shipping_receipt_number ?? '',
      courier_name: body.courier_name ?? '',
    });
    return { order: formatOrderForApi(updated) };
  } finally {
    client.release();
  }
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
