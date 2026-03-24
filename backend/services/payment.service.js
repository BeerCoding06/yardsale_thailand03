import { AppError } from '../utils/AppError.js';
import { withTransaction } from '../models/db.js';
import * as orderModel from '../models/order.model.js';
import * as orderService from './order.service.js';

function parseBool(v) {
  if (v === true || v === 'true' || v === '1') return true;
  return false;
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

    const slipUrl = file ? `/uploads/${file.filename}` : null;
    const updated = await orderModel.updateOrderStatus(client, orderId, 'paid', {
      slipImageUrl: slipUrl,
    });
    return { order: updated, paid: true };
  });
}
