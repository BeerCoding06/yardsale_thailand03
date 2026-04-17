import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/AppError.js';
import * as productService from '../services/product.service.js';

export const listProducts = asyncHandler(async (req, res) => {
  const data = await productService.listProducts(req.query);
  sendSuccess(res, data);
});

export const getProduct = asyncHandler(async (req, res) => {
  const u = req.user;
  const data = await productService.getProduct(req.params.id, {
    includeCancelled: u?.role === 'admin',
    viewerUserId: u?.id ?? null,
    viewerRole: u?.role ?? null,
  });
  sendSuccess(res, { product: data });
});

export const search = asyncHandler(async (req, res) => {
  const q = req.query.q || req.query.search;
  const data = await productService.searchProducts(q || '', req.query);
  sendSuccess(res, data);
});

export const wpPost = asyncHandler(async (req, res) => {
  const id = req.query.id;
  if (!id) {
    throw new AppError('Query id is required', 400, 'VALIDATION_ERROR');
  }
  const u = req.user;
  const data = await productService.getWpPost(id, {
    viewerUserId: u?.id ?? null,
    viewerRole: u?.role ?? null,
  });
  sendSuccess(res, data);
});
