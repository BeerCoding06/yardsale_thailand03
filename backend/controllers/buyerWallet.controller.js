import { AppError } from '../utils/AppError.js';
import * as buyerWalletService from '../services/buyerWallet.service.js';
import { config } from '../config/index.js';

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

/* ===== Refund Requests ===== */

export async function getEligibleOrders(req, res) {
  try {
    const data = await buyerWalletService.listEligibleOrdersForRefund(req.user.id);
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function submitRefundRequest(req, res) {
  try {
    const orderId = req.body?.order_id;
    const reason = req.body?.reason;
    const note = req.body?.note;
    if (!orderId) throw new AppError('order_id is required', 422, 'VALIDATION_ERROR');

    const files = Array.isArray(req.files) ? req.files : [];
    const base = String(config.publicUploadBase || '/uploads').replace(/\/$/, '') || '/uploads';
    const evidencePaths = files.map((f) => `${base}/${f.filename}`);
    // Accept optional product_items in body (JSON array or stringified JSON)
    let productItems = req.body?.product_items || req.body?.product_items_json || null;
    if (typeof productItems === 'string' && productItems.trim()) {
      try {
        productItems = JSON.parse(productItems);
      } catch {
        productItems = null;
      }
    }

    const data = await buyerWalletService.userRequestRefund(req.user.id, {
      orderId,
      reason,
      note,
      evidencePaths,
      productItems,
    });
    return res.status(201).json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function listMyRefundRequests(req, res) {
  try {
    const data = await buyerWalletService.listMyRefundRequests(req.user.id);
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function adminListRefundRequests(req, res) {
  try {
    const data = await buyerWalletService.adminListRefundRequests(req.query);
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function adminApproveRefundRequest(req, res) {
  try {
    const { id } = req.params;
    const { admin_note: adminNote } = req.body;
    if (!id) throw new AppError('id is required', 422, 'VALIDATION_ERROR');
    const data = await buyerWalletService.adminApproveRefundRequest(req.user.id, id, adminNote);
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

export async function adminRejectRefundRequest(req, res) {
  try {
    const { id } = req.params;
    const { admin_note: adminNote, rejection_reason: rejectionReason } = req.body;
    if (!id) throw new AppError('id is required', 422, 'VALIDATION_ERROR');
    const data = await buyerWalletService.adminRejectRefundRequest(req.user.id, id, adminNote, rejectionReason);
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
}
