import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/AppError.js';
import * as orderService from '../services/order.service.js';

export const createOrder = asyncHandler(async (req, res) => {
  const data = await orderService.createOrder(req.user.id, req.body);
  sendSuccess(res, data, 201);
});

export const getOrder = asyncHandler(async (req, res) => {
  const data = await orderService.getOrder(req.params.id, req.user.id, req.user.role);
  sendSuccess(res, data);
});

export const myOrders = asyncHandler(async (req, res) => {
  const data = await orderService.listMyOrders(req.user.id);
  sendSuccess(res, { success: true, orders: data.orders });
});

/** user = ลูกค้าที่ขายของได้ (seller_id = ตัวเอง) — เหมือน GET /my-products */
export const sellerOrders = asyncHandler(async (req, res) => {
  const role = req.user.role;
  if (!['user', 'seller', 'admin'].includes(role)) {
    throw new AppError('Seller access required', 403, 'FORBIDDEN');
  }
  const data =
    role === 'admin'
      ? await orderService.listAllOrdersAdmin()
      : await orderService.listSellerOrders(req.user.id);
  sendSuccess(res, { success: true, orders: data.orders });
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const data = await orderService.cancelOrder(req.body.order_id, req.user.id, req.user.role);
  sendSuccess(res, { success: true, ...data });
});

export const patchSellerOrderFulfillment = asyncHandler(async (req, res) => {
  const data = await orderService.updateSellerOrderFulfillment(
    req.user.id,
    req.params.orderId,
    req.body,
    req.user.role
  );
  sendSuccess(res, data);
});
