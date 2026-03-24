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

export async function restoreStockForOrder(client, orderId) {
  const items = await orderModel.getOrderItems(client, orderId);
  for (const it of items) {
    await productModel.incrementProductStock(client, it.product_id, it.quantity);
  }
}

/**
 * Create order: single transaction, FOR UPDATE on products, deduct stock, insert order + items.
 */
export async function createOrder(userId, lineItemsRaw) {
  const lineItems = aggregateLineItems(lineItemsRaw);
  if (!lineItems.length) {
    throw new AppError('No line items', 400, 'EMPTY_CART');
  }

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
    });
    await orderModel.insertOrderItems(client, order.id, pricedLines);

    const cartId = await cartModel.getOrCreateCart(client, userId);
    await cartModel.clearCart(client, cartId);

    const items = await orderModel.getOrderItems(client, order.id);
    return { order: { ...order, line_items: items } };
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
    return { order: { ...order, line_items: items } };
  } finally {
    client.release();
  }
}

export async function listMyOrders(userId) {
  const client = await pool.connect();
  try {
    const orders = await orderModel.listOrdersForUser(client, userId);
    return { orders };
  } finally {
    client.release();
  }
}

export async function listSellerOrders(sellerId) {
  const client = await pool.connect();
  try {
    const orders = await orderModel.listOrdersForSeller(client, sellerId);
    return { orders };
  } finally {
    client.release();
  }
}

export async function listAllOrdersAdmin() {
  const client = await pool.connect();
  try {
    const orders = await orderModel.listAllOrders(client);
    return { orders };
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
      return { order, alreadyCanceled: true };
    }

    // Stock was already returned when payment failed (mock).
    if (order.status === 'payment_failed') {
      const updated = await orderModel.updateOrderStatus(client, orderId, 'canceled');
      return { order: updated };
    }

    await restoreStockForOrder(client, orderId);
    const updated = await orderModel.updateOrderStatus(client, orderId, 'canceled');
    return { order: updated };
  });
}
