import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import { pool } from '../models/db.js';
import * as trackingLogModel from '../models/trackingLog.model.js';
import * as thailandPost from './thailandPost.service.js';
import * as seventeenTrack from './seventeenTrack.service.js';

export { isThailandPostBarcode } from './thailandPost.service.js';

export function mapNormalizedToShippingStatus(normalized) {
  if (!normalized) return 'shipped';
  if (normalized.provider === 'thailand_post') {
    return thailandPost.mapNormalizedToShippingStatus(normalized);
  }
  return seventeenTrack.mapNormalizedToShippingStatus(normalized);
}

/**
 * Resolve tracking for fulfillment — Thailand Post first for *TH barcodes, else 17TRACK.
 */
export async function tryResolveTrackingForFulfillment(trackingNumber, carrier) {
  const tn = String(trackingNumber || '').trim();
  if (!tn) return null;

  if (thailandPost.isThailandPostBarcode(tn) && config.thailandPost.apiKey) {
    const thp = await thailandPost.tryResolveTrackingForFulfillment(tn);
    if (thp) return thp;
  }

  return seventeenTrack.tryResolveTrackingForFulfillment(tn, carrier);
}

/**
 * POST /api/track — route to Thailand Post or 17TRACK.
 */
export async function trackShipment({ trackingNumber, carrier, language }) {
  const tn = String(trackingNumber || '').trim();
  if (!tn) {
    throw new AppError('trackingNumber is required', 400, 'VALIDATION_ERROR');
  }

  let resolved = null;

  if (thailandPost.isThailandPostBarcode(tn) && config.thailandPost.apiKey) {
    try {
      const thp = await thailandPost.trackShipment({ trackingNumber: tn, language });
      resolved = { normalized: thp, upstream: thp.upstream, provider: 'thailand_post' };
    } catch (e) {
      if (
        e instanceof AppError &&
        !['TRACKING_NOT_CONFIGURED', 'TRACKING_NOT_THAILAND_POST'].includes(e.code)
      ) {
        throw e;
      }
    }
  }

  if (!resolved) {
    if (!config.seventeenTrack.apiKey) {
      if (thailandPost.isThailandPostBarcode(tn) && !config.thailandPost.apiKey) {
        throw new AppError(
          'Thailand Post tracking is not configured (set THAILAND_POST_API_KEY)',
          503,
          'TRACKING_NOT_CONFIGURED'
        );
      }
      throw new AppError('Shipment tracking is not configured', 503, 'TRACKING_NOT_CONFIGURED');
    }
    const st = await seventeenTrack.tryResolveTrackingForFulfillment(tn, carrier);
    if (!st) {
      throw new AppError('Could not load tracking information', 502, 'TRACKING_LOOKUP_FAILED');
    }
    resolved = { ...st, provider: '17track' };
  }

  const normalized = resolved.normalized;
  const upstream = resolved.upstream;

  const client = await pool.connect();
  try {
    await trackingLogModel.insertTrackingLog(client, {
      trackingNumber: normalized.trackingNumber,
      carrier: normalized.carrier,
      status: normalized.currentStatus,
      rawResponse: upstream,
    });
  } finally {
    client.release();
  }

  return {
    trackingNumber: normalized.trackingNumber,
    carrier: normalized.carrier,
    carrierCode: normalized.carrierCode ?? null,
    provider: normalized.provider || resolved.provider,
    currentStatus: normalized.currentStatus,
    updatedAt: normalized.updatedAt,
    trackingHistory: normalized.trackingHistory,
  };
}
