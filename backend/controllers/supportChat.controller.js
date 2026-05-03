import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as supportChatService from '../services/supportChat.service.js';

export const start = asyncHandler(async (req, res) => {
  const orderRaw = req.body?.order_id;
  const order_id =
    orderRaw && String(orderRaw).trim() !== '' ? String(orderRaw).trim() : undefined;
  const data = await supportChatService.startConversation(req.user.id, { order_id });
  sendSuccess(res, data);
});

export const unreadForUser = asyncHandler(async (req, res) => {
  const data = await supportChatService.getUnreadCountForUser(req.user.id);
  sendSuccess(res, data);
});

export const adminList = asyncHandler(async (req, res) => {
  const data = await supportChatService.listAdminConversations(req.query);
  sendSuccess(res, data);
});

export const messages = asyncHandler(async (req, res) => {
  const data = await supportChatService.getMessages(req.user.role, req.user.id, req.params.id, req.query);
  sendSuccess(res, data);
});

export const send = asyncHandler(async (req, res) => {
  const data = await supportChatService.sendMessage(
    req.user.role,
    req.user.id,
    req.params.id,
    req.body.message
  );
  sendSuccess(res, data);
});

export const resolve = asyncHandler(async (req, res) => {
  const data = await supportChatService.resolveConversation(req.params.id);
  sendSuccess(res, data);
});
