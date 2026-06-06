import { AppError } from '../../utils/AppError.js';
import {
  buildNormalizedFromEvents,
  extractEventsFromGenericJson,
  mapScrapedToShippingStatus,
  scrapeFetch,
} from './scrapeNormalize.js';

const CARRIER = 'J&T Express';
const PROVIDER = 'scrape_jt';

const ENDPOINTS = [
  {
    name: 'jt-v1-track',
    run: async (tn) => {
      const url = `https://jtexpress.co.th/v1/track/trackings?lang=th&billCodes=${encodeURIComponent(tn)}`;
      const { res, json } = await scrapeFetch(url, { method: 'GET' });
      if (!res.ok || !json) return null;
      return { json, source: 'jt-v1-track' };
    },
  },
  {
    name: 'jt-web-track',
    run: async (tn) => {
      const { res, json, text } = await scrapeFetch(
        `https://jtexpress.co.th/track/${encodeURIComponent(tn)}`,
        { method: 'GET', headers: { Accept: 'text/html,application/json' } }
      );
      if (json) return { json, source: 'jt-web-track' };
      if (text && text.includes('track')) {
        return { json: { html: text.slice(0, 120000) }, source: 'jt-web-html' };
      }
      if (!res.ok) return null;
      return null;
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

  throw new AppError('J&T Express tracking not found or website layout changed', 502, 'TRACKING_SCRAPE_FAILED');
}
