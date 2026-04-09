import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import * as seventeenTrackService from '../services/seventeenTrack.service.js';

export const trackShipment = asyncHandler(async (req, res) => {
  const { trackingNumber, carrier } = req.body;
  const data = await seventeenTrackService.trackShipment({ trackingNumber, carrier });
  sendSuccess(res, data);
});
