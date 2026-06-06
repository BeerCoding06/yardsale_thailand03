import { AppError } from '../../utils/AppError.js';
import {
  buildNormalizedFromEvents,
  extractEventsFromGenericJson,
  mapScrapedToShippingStatus,
  scrapeFetch,
} from './scrapeNormalize.js';

const CARRIER = 'Flash Express';
const PROVIDER = 'scrape_flash';

const ENDPOINTS = [
  {
    name: 'fle-tracking-query',
    run: async (tn) => {
      const { res, json } = await scrapeFetch(
        'https://www.flashexpress.co.th/fle/webApi/courier/v1/tracking/query',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ searchType: 1, waybillNoList: [tn] }),
        }
      );
      if (!res.ok || !json) return null;
      return { json, source: 'fle-tracking-query' };
    },
  },
  {
    name: 'flashexpress-open-routes',
    run: async (tn) => {
      const { res, json } = await scrapeFetch(
        `https://api.flashexpress.com/open/v1/orders/${encodeURIComponent(tn)}/routes`,
        { method: 'GET' }
      );
      if (!res.ok || !json) return null;
      return { json, source: 'flashexpress-open-routes' };
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

  let lastErr;
  for (const ep of ENDPOINTS) {
    try {
      const upstream = await ep.run(tn);
      if (!upstream?.json) continue;
      const events = extractEventsFromGenericJson(upstream.json);
      if (!events.length) continue;
      const normalized = buildNormalizedFromEvents(tn, CARRIER, PROVIDER, events, upstream);
      return { normalized, upstream: upstream.json, ...normalized };
    } catch (e) {
      lastErr = e;
    }
  }

  throw new AppError(
    lastErr instanceof AppError
      ? lastErr.message
      : 'Flash Express tracking not found or website layout changed',
    502,
    'TRACKING_SCRAPE_FAILED'
  );
}
