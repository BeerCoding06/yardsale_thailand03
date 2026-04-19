import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendSuccessNoStore } from '../utils/response.js';
import * as sellerWalletService from '../services/sellerWallet.service.js';

export const getWallet = asyncHandler(async (req, res) => {
  const data = await sellerWalletService.getWalletOverview(req.user.id);
  sendSuccessNoStore(res, data);
});

export const getWithdrawalBankOptions = asyncHandler(async (_req, res) => {
  const data = sellerWalletService.getPayoutBankOptions();
  sendSuccessNoStore(res, data);
});

export const postWithdraw = asyncHandler(async (req, res) => {
  const data = await sellerWalletService.requestWithdrawal(req.user.id, req.body);
  sendSuccess(res, data, 201);
});

export const getWithdrawals = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit) || 50;
  const offset = Number(req.query.offset) || 0;
  const data = await sellerWalletService.listMyWithdrawals(req.user.id, { limit, offset });
  sendSuccessNoStore(res, data);
});
