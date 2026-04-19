import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendSuccessNoStore } from '../utils/response.js';
import * as sellerWalletService from '../services/sellerWallet.service.js';

export const getWalletDashboard = asyncHandler(async (_req, res) => {
  const data = await sellerWalletService.getAdminWithdrawalDashboard();
  sendSuccessNoStore(res, data);
});

export const getAdminWithdrawals = asyncHandler(async (req, res) => {
  const data = await sellerWalletService.adminListWithdrawals(req.query);
  sendSuccessNoStore(res, data);
});

export const postApproveWithdrawal = asyncHandler(async (req, res) => {
  const data = await sellerWalletService.adminApproveWithdrawal(
    req.user.id,
    req.params.id,
    req.body?.admin_notes
  );
  sendSuccess(res, data);
});

export const postRejectWithdrawal = asyncHandler(async (req, res) => {
  const data = await sellerWalletService.adminRejectWithdrawal(
    req.user.id,
    req.params.id,
    req.body?.admin_notes
  );
  sendSuccess(res, data);
});

export const postMarkWithdrawalPaid = asyncHandler(async (req, res) => {
  const data = await sellerWalletService.adminMarkWithdrawalPaid(req.user.id, req.params.id);
  sendSuccess(res, data);
});

export const getAdminSellerWallet = asyncHandler(async (req, res) => {
  const data = await sellerWalletService.adminGetSellerWallet(req.params.sellerId);
  sendSuccessNoStore(res, data);
});

export const getAdminWalletLedger = asyncHandler(async (req, res) => {
  const data = await sellerWalletService.adminListWalletLedger(req.query);
  sendSuccessNoStore(res, data);
});

export const getAdminWalletAuditLog = asyncHandler(async (req, res) => {
  const data = await sellerWalletService.adminListFinancialAuditLogs(req.query);
  sendSuccessNoStore(res, data);
});

export const getAdminWithdrawalDetail = asyncHandler(async (req, res) => {
  const data = await sellerWalletService.adminGetWithdrawalDetail(req.params.id);
  sendSuccessNoStore(res, data);
});
