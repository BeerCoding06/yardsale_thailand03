import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as cartService from '../services/cart.service.js';

export const add = asyncHandler(async (req, res) => {
  const data = await cartService.addToCart(
    req.user.id,
    req.body.product_id,
    req.body.quantity ?? 1
  );
  sendSuccess(res, data);
});

export const update = asyncHandler(async (req, res) => {
  const data = await cartService.updateCart(req.user.id, req.body.items);
  sendSuccess(res, data);
});

export const refreshStock = asyncHandler(async (req, res) => {
  const data = await cartService.refreshCartStock(req.user.id);
  sendSuccess(res, data);
});

export const checkStock = asyncHandler(async (req, res) => {
  const data = await cartService.checkCartStock(req.body.items);
  sendSuccess(res, data);
});
