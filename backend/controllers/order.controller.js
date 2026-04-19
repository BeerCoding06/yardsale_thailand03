import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendSuccessNoStore } from '../utils/response.js';
import { AppError } from '../utils/AppError.js';
import { parsePaginationQuery, parseSearchQuery } from '../utils/pagination.js';
import * as orderService from '../services/order.service.js';

export const createOrder = asyncHandler(async (req, res) => {
  const data = await orderService.createOrder(req.user.id, req.body);
  sendSuccess(res, data, 201);
});

export const getOrder = asyncHandler(async (req, res) => {
  const data = await orderService.getOrder(req.params.id, req.user.id, req.user.role);
  sendSuccessNoStore(res, data);
});

export const myOrders = asyncHandler(async (req, res) => {
  const { page, pageSize, offset } = parsePaginationQuery(req.query, {
    defaultPageSize: 10,
    maxPageSize: 50,
  });
  const search = parseSearchQuery(req.query);
  const data = await orderService.listMyOrders(req.user.id, {
    page,
    pageSize,
    offset,
    search,
  });
  sendSuccessNoStore(res, {
    success: true,
    orders: data.orders,
    pagination: data.pagination,
  });
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
  sendSuccessNoStore(res, { success: true, orders: data.orders, pagination: data.pagination });
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

/** แอดมิน: ตั้งสถานะออเดอร์เป็น paid */
export const markOrderPaidAdmin = asyncHandler(async (req, res) => {
  const slipRaw = req.body?.slip_image_url;
  const slipImageUrl =
    slipRaw != null && String(slipRaw).trim() !== '' ? String(slipRaw).trim() : undefined;
  const data = await orderService.markOrderPaidAsAdmin(req.params.orderId, {
    slipImageUrl,
  });
  sendSuccess(res, { success: true, ...data });
});

/** ผู้ซื้อ: ยืนยันรับสินค้า (คู่กับติดตามพัสดุ — ปล่อยเงินจาก escrow เมื่อเงื่อนไขครบ) */
export const confirmBuyerDelivery = asyncHandler(async (req, res) => {
  const data = await orderService.confirmBuyerDelivery(req.params.orderId, req.user.id);
  sendSuccess(res, { success: true, ...data });
});

/** แอดมิน: บังคับสถานะจัดส่งเป็น delivered + พยายามปล่อยเงิน */
export const adminMarkOrderDelivered = asyncHandler(async (req, res) => {
  const data = await orderService.adminMarkOrderDelivered(req.params.orderId);
  sendSuccess(res, { success: true, ...data });
});

/** แอดมิน: แก้สถานะชำระเงิน / ยอดรวม / ข้อมูลจัดส่ง */
export const adminPatchOrder = asyncHandler(async (req, res) => {
  const data = await orderService.adminPatchOrder(req.params.orderId, req.body);
  sendSuccess(res, { success: true, ...data });
});
