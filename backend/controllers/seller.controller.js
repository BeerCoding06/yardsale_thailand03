import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import { parsePaginationQuery, parseSearchQuery } from '../utils/pagination.js';
import * as sellerService from '../services/seller.service.js';

function userRole(req) {
  return req.user?.role || 'user';
}

export const myProducts = asyncHandler(async (req, res) => {
  const q = req.query?.own_only;
  const ownOnly =
    q === '1' || q === 'true' || (Array.isArray(q) && (q[0] === '1' || q[0] === 'true'));
  const { page, pageSize, offset } = parsePaginationQuery(req.query, {
    defaultPageSize: 20,
    maxPageSize: 100,
  });
  const search = parseSearchQuery(req.query);
  const modQ = req.query?.moderation_only;
  const moderationOnly =
    modQ === '1' ||
    modQ === 'true' ||
    (Array.isArray(modQ) && (modQ[0] === '1' || modQ[0] === 'true'));
  const data = await sellerService.myProducts(req.user.id, userRole(req), {
    ownOnly,
    page,
    pageSize,
    offset,
    search,
    moderationOnly,
  });
  sendSuccess(res, { success: true, ...data });
});

export const createProduct = asyncHandler(async (req, res) => {
  const data = await sellerService.createProduct(req.user.id, req.body, userRole(req));
  sendSuccess(res, { success: true, ...data }, 201);
});

export const updateProduct = asyncHandler(async (req, res) => {
  const data = await sellerService.updateProduct(req.user.id, userRole(req), req.body);
  sendSuccess(res, { success: true, ...data });
});

export const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400, 'VALIDATION_ERROR');
  }
  const sourceUrl = `${config.publicUploadBase}/${req.file.filename}`;
  sendSuccess(res, { success: true, image: { sourceUrl } });
});

export const cancelProduct = asyncHandler(async (req, res) => {
  const data = await sellerService.cancelProduct(
    req.user.id,
    req.body.product_id,
    userRole(req)
  );
  sendSuccess(res, { success: true, ...data });
});

export const restoreProduct = asyncHandler(async (req, res) => {
  const data = await sellerService.restoreProduct(
    req.user.id,
    req.body.product_id,
    userRole(req)
  );
  sendSuccess(res, { success: true, ...data });
});
