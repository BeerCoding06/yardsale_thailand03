import { AppError } from '../utils/AppError.js';
import * as buyerWalletService from '../services/buyerWallet.service.js';

function handleError(res, err) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, error: { message: err.message, code: err.code } });
  }
  console.error('[buyerWallet]', err);
  return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
}

/* ===== User endpoints ===== */

export async function getMyBuyerWallet(req, res) {
  try {
    const data = await buyerWalletService.getMyBuyerWallet(req.user.id);
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function listMyBuyerWalletTxs(req, res) {
  try {
    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;
    const data = await buyerWalletService.listMyBuyerWalletTxs(req.user.id, { limit, offset });
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

/* ===== Admin endpoints ===== */

export async function adminGetBuyerWalletSummary(req, res) {
  try {
    const data = await buyerWalletService.adminGetBuyerWalletSummary();
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function adminListBuyerWalletTxs(req, res) {
  try {
    const data = await buyerWalletService.adminListBuyerWalletTxs(req.query);
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function adminListRefunds(req, res) {
  try {
    const data = await buyerWalletService.adminListRefunds(req.query);
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function adminManualRefund(req, res) {
  try {
    const { order_id: orderId, reason, note } = req.body;
    if (!orderId) {
      throw new AppError('order_id is required', 422, 'VALIDATION_ERROR');
    }
    const data = await buyerWalletService.adminManualRefund(req.user.id, { orderId, reason, note });
    return res.json({ success: true, ...data });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function adminTriggerUnshippedRefunds(req, res) {
  try {
    const data = await buyerWalletService.triggerUnshippedOrderRefunds(req.user.id);
    return res.json({ success: true, ...data });
  } catch (err) {
    return handleError(res, err);
  }
}
