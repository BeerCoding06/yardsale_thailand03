import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import { pool } from '../models/db.js';
import * as trackingLogModel from '../models/trackingLog.model.js';
import * as thailandPost from './thailandPost.service.js';
import * as seventeenTrack from './seventeenTrack.service.js';
import { resolveTrackingProvider } from './courierRouter.js';

export { isThailandPostBarcode } from './thailandPost.service.js';
export { resolveTrackingProvider, courierTrackingUrl } from './courierRouter.js';

export function mapNormalizedToShippingStatus(normalized) {
  if (!normalized) return 'shipped';
  const provider = normalized.provider;
  if (provider === 'thailand_post') {
    return thailandPost.mapNormalizedToShippingStatus(normalized);
  }
  return seventeenTrack.mapNormalizedToShippingStatus(normalized);
}

async function resolveByProvider(route, { trackingNumber, carrier, language }) {
  const tn = String(trackingNumber || '').trim();
  if (route.provider === 'thailand_post') {
    const thp = await thailandPost.trackShipment({ trackingNumber: tn, language });
    return { normalized: thp, upstream: thp.upstream, provider: 'thailand_post' };
  }

  const c = route.seventeenTrackCarrier ?? carrier;
  const st = await seventeenTrack.tryResolveTrackingForFulfillment(tn, c);
  if (!st) {
    throw new AppError('Could not load tracking from 17TRACK', 502, 'TRACKING_LOOKUP_FAILED');
  }
  if (st.normalized && route.carrierLabel && !st.normalized.carrier) {
    st.normalized.carrier = route.carrierLabel;
  }
  return { ...st, provider: '17track' };
}

/**
 * Resolve tracking for fulfillment — Thailand Post or 17TRACK.
 */
export async function tryResolveTrackingForFulfillment(trackingNumber, options = {}) {
  const tn = String(trackingNumber || '').trim();
  if (!tn) return null;

  const carrier = options.carrier ?? options.seventeenTrackCarrier;
  const courierName = options.courierName ?? options.courier_name;
  const route = resolveTrackingProvider({ trackingNumber: tn, courierName, carrier });

  if (route.provider === 'thailand_post' && !config.thailandPost.apiKey) return null;
  if (route.provider === '17track' && !config.seventeenTrack.apiKey) return null;

  try {
    return await resolveByProvider(route, {
      trackingNumber: tn,
      carrier: route.seventeenTrackCarrier ?? carrier,
      language: options.language,
    });
  } catch {
    return null;
  }
}

/**
 * POST /api/track — Thailand Post | 17TRACK (all other carriers)
 */
export async function trackShipment({ trackingNumber, carrier, language, courierName }) {
  const tn = String(trackingNumber || '').trim();
  if (!tn) {
    throw new AppError('trackingNumber is required', 400, 'VALIDATION_ERROR');
  }

  const route = resolveTrackingProvider({ trackingNumber: tn, courierName, carrier });

  if (route.provider === 'thailand_post' && !config.thailandPost.apiKey) {
    throw new AppError(
      'Thailand Post tracking is not configured (set THAILAND_POST_API_KEY_B64)',
      503,
      'TRACKING_NOT_CONFIGURED'
    );
  }
  if (route.provider === '17track' && !config.seventeenTrack.apiKey) {
    throw new AppError(
      '17TRACK is not configured (required for non–Thailand Post carriers)',
      503,
      'TRACKING_NOT_CONFIGURED'
    );
  }

  const resolved = await resolveByProvider(route, {
    trackingNumber: tn,
    carrier: route.seventeenTrackCarrier ?? carrier,
    language,
  });

  const normalized = resolved.normalized;
  const upstream = resolved.upstream;

  const client = await pool.connect();
  try {
    try {
      await trackingLogModel.insertTrackingLog(client, {
        trackingNumber: normalized.trackingNumber,
        carrier: normalized.carrier,
        status: normalized.currentStatus,
        rawResponse: upstream,
      });
    } catch (e) {
      const code = e?.code;
      if (code !== '42P01' && code !== '42703') throw e;
    }
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
