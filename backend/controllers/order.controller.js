import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/AppError.js';
import { parsePaginationQuery, parseSearchQuery } from '../utils/pagination.js';
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
  const { page, pageSize, offset } = parsePaginationQuery(req.query);
  const search = parseSearchQuery(req.query);
  const data = await orderService.listMyOrders(req.user.id, {
    page,
    pageSize,
    offset,
    search,
  });
  sendSuccess(res, { success: true, orders: data.orders, pagination: data.pagination });
});

/** user/seller เห็นออเดอร์ที่มีสินค้าของตน; แอดมินเห็นทั้งระบบ */
export const sellerOrders = asyncHandler(async (req, res) => {
  const role = req.user.role;
  if (!['user', 'seller', 'admin'].includes(role)) {
    throw new AppError('Seller access required', 403, 'FORBIDDEN');
  }
  const { page, pageSize, offset } = parsePaginationQuery(req.query);
  const search = parseSearchQuery(req.query);
  const data =
    role === 'admin'
      ? await orderService.listAllOrdersAdmin({ page, pageSize, offset, search })
      : await orderService.listSellerOrders(req.user.id, { page, pageSize, offset, search });
  sendSuccess(res, { success: true, orders: data.orders, pagination: data.pagination });
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

/** แอดมิน: ตั้งสถานะออเดอร์เป็น paid (ไม่ผ่าน SlipOK) */
export const markOrderPaidAdmin = asyncHandler(async (req, res) => {
  const slipRaw = req.body?.slip_image_url;
  const slipImageUrl =
    slipRaw != null && String(slipRaw).trim() !== '' ? String(slipRaw).trim() : undefined;
  const data = await orderService.markOrderPaidAsAdmin(req.params.orderId, {
    slipImageUrl,
  });
  sendSuccess(res, { success: true, ...data });
});
