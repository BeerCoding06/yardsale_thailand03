import { AppError } from '../../utils/AppError.js';
import {
  buildNormalizedFromEvents,
  extractEventsFromGenericJson,
  mapScrapedToShippingStatus,
  scrapeFetch,
} from './scrapeNormalize.js';

const CARRIER = 'Kerry Express';
const PROVIDER = 'scrape_kerry';

const ENDPOINTS = [
  {
    name: 'kex-ke-web-track',
    run: async (tn) => {
      const { res, json } = await scrapeFetch(
        'https://th.kerryexpress.com/ke-web/api/v1/shipment-tracking/track',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ consignmentNo: tn }),
        }
      );
      if (!res.ok || !json) return null;
      return { json, source: 'kex-ke-web-track' };
    },
  },
  {
    name: 'kex-legacy-get',
    run: async (tn) => {
      const { res, json } = await scrapeFetch(
        `https://th.kerryexpress.com/ke-web/api/tracking/v1/tracking?trackingNo=${encodeURIComponent(tn)}`,
        { method: 'GET' }
      );
      if (!res.ok || !json) return null;
      return { json, source: 'kex-legacy-get' };
    },
  },
];

export { mapScrapedToShippingStatus };

export async function tryResolveTrackingForFulfillment(trackingNumber) {
  try {
    return await trackShipment({ trackingNumber });
  } catch {
    return null;
  }
}

export async function trackShipment({ trackingNumber }) {
  const tn = String(trackingNumber || '')
    .trim()
    .toUpperCase();
  if (!tn) {
    throw new AppError('trackingNumber is required', 400, 'VALIDATION_ERROR');
  }

  for (const ep of ENDPOINTS) {
    try {
      const upstream = await ep.run(tn);
      if (!upstream?.json) continue;
      const events = extractEventsFromGenericJson(upstream.json);
      if (!events.length) continue;
      const normalized = buildNormalizedFromEvents(tn, CARRIER, PROVIDER, events, upstream);
      return { normalized, upstream: upstream.json, ...normalized };
    } catch {
      /* try next */
    }
  }

  throw new AppError(
    'Kerry Express tracking not found or website layout changed',
    502,
    'TRACKING_SCRAPE_FAILED'
  );
}
