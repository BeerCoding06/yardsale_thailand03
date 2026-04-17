import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/AppError.js';
import { paymentMockBodySchema } from '../validators/schemas.js';
import * as paymentService from '../services/payment.service.js';

function normalizePaymentMockBody(body) {
  if (!body || typeof body !== 'object') return body;
  const b = body;
  if (typeof b.slip_url === 'string') {
    let u = b.slip_url.trim();
    if (u && !/^https?:\/\//i.test(u)) u = `https://${u}`;
    b.slip_url = u;
  }
  if (typeof b.amount === 'string' && /^\d+(\.\d+)?$/.test(b.amount.trim())) {
    const n = Number(b.amount.trim());
    if (Number.isFinite(n) && n > 0) b.amount = n;
  }
  return body;
}

export const mockPayment = asyncHandler(async (req, res) => {
  normalizePaymentMockBody(req.body);
  const { error, value } = paymentMockBodySchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    const message = error.details.map((d) => d.message).join('; ');
    throw new AppError(message, 422, 'VALIDATION_ERROR');
  }
  const data = await paymentService.mockPayment(req.user.id, value, req.file);
  /** sendSuccess ใส่ success ที่ชั้นนอกแล้ว — อย่าใส่ success ซ้ำใน data */
  sendSuccess(res, data);
});

export const slipokQuota = asyncHandler(async (_req, res) => {
  const data = await paymentService.getSlipokQuota();
  sendSuccess(res, data);
});
