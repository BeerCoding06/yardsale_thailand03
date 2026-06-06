import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as trackingService from '../services/tracking.service.js';

export const trackShipment = asyncHandler(async (req, res) => {
  const { trackingNumber, carrier, language } = req.body;
  const data = await trackingService.trackShipment({ trackingNumber, carrier, language });
  sendSuccess(res, data);
});
