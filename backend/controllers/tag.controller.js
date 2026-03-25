import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as tagService from '../services/tag.service.js';

export const listTags = asyncHandler(async (req, res) => {
  const rows = await tagService.listTags();
  const nodes = rows.map(tagService.toTagNode);
  sendSuccess(res, { tags: nodes, productTags: { nodes } });
});

export const createTag = asyncHandler(async (req, res) => {
  const row = await tagService.createTag(req.body);
  sendSuccess(res, { tag: tagService.toTagNode(row) }, 201);
});

export const updateTag = asyncHandler(async (req, res) => {
  const { tag_id, ...rest } = req.body;
  const row = await tagService.updateTag(tag_id, rest);
  sendSuccess(res, { tag: tagService.toTagNode(row) });
});

export const deleteTag = asyncHandler(async (req, res) => {
  const out = await tagService.deleteTag(req.body.tag_id);
  sendSuccess(res, out);
});
