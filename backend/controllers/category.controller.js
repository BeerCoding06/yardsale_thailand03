import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as categoryService from '../services/category.service.js';
import * as tagService from '../services/tag.service.js';

function formatCategoryNode(row) {
  if (!row) return null;
  const image_url = row.image_url && String(row.image_url).trim();
  return {
    id: row.id,
    databaseId: row.id,
    name: row.name,
    slug: row.slug,
    description: '',
    image: image_url ? { sourceUrl: image_url } : undefined,
    parent: null,
    count: 0,
    children: { nodes: [] },
    products: { nodes: [] },
  };
}

export const categories = asyncHandler(async (req, res) => {
  const rows = await categoryService.listCategories();
  const nodes = rows.map(formatCategoryNode);
  sendSuccess(res, { categories: nodes, productCategories: { nodes } });
});

export const wpCategories = asyncHandler(async (req, res) => {
  const rows = await categoryService.listCategories();
  const nodes = rows.map(formatCategoryNode);
  sendSuccess(res, { productCategories: { nodes } });
});

export const wpTags = asyncHandler(async (req, res) => {
  const rows = await tagService.listTags();
  const nodes = rows.map(tagService.toTagNode);
  sendSuccess(res, { productTags: { nodes } });
});

export const createCategory = asyncHandler(async (req, res) => {
  const row = await categoryService.createCategory(req.body);
  sendSuccess(res, { category: formatCategoryNode(row) }, 201);
});

export const updateCategory = asyncHandler(async (req, res) => {
  const { category_id, ...rest } = req.body;
  const row = await categoryService.updateCategory(category_id, rest);
  sendSuccess(res, { category: formatCategoryNode(row) });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const out = await categoryService.deleteCategory(req.body.category_id);
  sendSuccess(res, out);
});
