import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as categoryService from '../services/category.service.js';

export const categories = asyncHandler(async (req, res) => {
  const rows = await categoryService.listCategories();
  sendSuccess(res, { categories: rows, productCategories: { nodes: rows } });
});

export const wpCategories = asyncHandler(async (req, res) => {
  const rows = await categoryService.listCategories();
  sendSuccess(res, { productCategories: { nodes: rows } });
});

export const wpTags = asyncHandler(async (req, res) => {
  sendSuccess(res, { productTags: { nodes: [] } });
});
