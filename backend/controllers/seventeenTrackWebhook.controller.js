import { asyncHandler } from '../utils/asyncHandler.js';
import * as webhookService from '../services/seventeenTrackWebhook.service.js';
import { AppError } from '../utils/AppError.js';

function rawBodyString(req) {
  if (req.body instanceof Buffer) return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  return '';
}

/** GET — quick check URL is reachable (17TRACK dashboard / load balancer) */
export const ping = asyncHandler(async (_req, res) => {
  res.status(200).json({ success: true, data: webhookService.pingResponse() });
});

/**
 * POST /api/webhooks/17track — 17TRACK Package Webhook V2.4
 * Must return HTTP 200 or 17TRACK will retry.
 */
export const receive = asyncHandler(async (req, res) => {
  const rawBody = rawBodyString(req);
  const signHeader = req.headers.sign || req.headers.Sign;

  try {
    const data = await webhookService.processWebhookRequest({ rawBody, signHeader });
    res.status(200).json({ success: true, data });
  } catch (err) {
    if (err instanceof AppError && (err.status === 401 || err.status === 400)) {
      res.status(err.status).json({
        success: false,
        error: { message: err.message, code: err.code },
      });
      return;
    }
    throw err;
  }
});
