/**
 * Shared helpers for carrier website scraping (Flash / J&T / Kerry).
 */

const DEFAULT_UA =
  'Mozilla/5.0 (compatible; YardsaleTracking/1.0; +https://www.yardsaleth.com)';

/**
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
export function parseLooseDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  const m = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const [, y, mo, da, h, mi, se = '00'] = m;
    const iso = `${y}-${mo}-${da}T${h}:${mi}:${se}+07:00`;
    const d2 = new Date(iso);
    if (!Number.isNaN(d2.getTime())) return d2.toISOString();
  }
  return null;
}

/**
 * @param {Array<{ time?: string | null, status?: string, location?: string, stage?: string }>} events
 */
export function buildNormalizedFromEvents(trackingNumber, carrier, provider, events, upstream) {
  const sorted = [...events].sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')));
  const latest = sorted[0];
  return {
    trackingNumber: String(trackingNumber || '').trim().toUpperCase(),
    carrier,
    carrierCode: null,
    provider,
    currentStatus: String(latest?.status || '').trim() || 'No status yet',
    updatedAt: latest?.time || null,
    trackingHistory: sorted.map((e) => ({
      time: e.time || null,
      status: String(e.status || '').trim(),
      location: String(e.location || '').trim(),
      stage: String(e.stage || '').trim(),
    })),
    upstream,
    _latestEvent: latest || null,
  };
}

/**
 * @param {object} normalized
 */
export function mapScrapedToShippingStatus(normalized) {
  if (!normalized) return 'shipped';
  const events = normalized.trackingHistory || [];
  const text = `${normalized.currentStatus || ''} ${events.map((e) => e.status).join(' ')}`.toLowerCase();

  if (
    /\bdelivered\b|จัดส่งสำเร็จ|นำส่งสำเร็จ|ส่งมอบแล้ว|received by|delivery success|pod\b/.test(
      text
    )
  ) {
    return 'delivered';
  }
  if (
    /out for delivery|กำลังนำส่ง|อยู่ระหว่างการนำจ่าย|นำส่งถึง|on vehicle|delivering/.test(
      text
    )
  ) {
    return 'out_for_delivery';
  }
  if (/in transit|ระหว่างขนส่ง|ขนส่ง|depart|arriv|hub|sort|picked up|รับพัสดุ|รับเข้า/.test(text)) {
    return 'shipped';
  }
  if (/รับฝาก|รับเข้าระบบ|order created|picked|accepted|info received/.test(text)) {
    return 'preparing';
  }
  return 'shipped';
}

/**
 * @param {string} url
 * @param {RequestInit} init
 */
export async function scrapeFetch(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': DEFAULT_UA,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { res, text, json };
}

/**
 * @param {unknown} json
 */
export function extractEventsFromGenericJson(json) {
  const events = [];

  function walk(node, depth = 0) {
    if (!node || depth > 10) return;
    if (Array.isArray(node)) {
      for (const item of node) {
        if (item && typeof item === 'object') {
          const status =
            item.status ||
            item.statusDesc ||
            item.status_desc ||
            item.statusDescription ||
            item.remark ||
            item.message ||
            item.description ||
            item.action ||
            item.state ||
            item.trackStatus ||
            item.track_status;
          const time =
            item.time ||
            item.datetime ||
            item.dateTime ||
            item.date_time ||
            item.operateTime ||
            item.operate_time ||
            item.scanTime ||
            item.scan_time ||
            item.createdAt ||
            item.created_at;
          const location =
            item.location ||
            item.siteName ||
            item.site_name ||
            item.city ||
            item.branch ||
            item.hubName ||
            item.hub_name ||
            '';

          if (status && (time || location)) {
            events.push({
              time: parseLooseDate(time),
              status: String(status).trim(),
              location: String(location || '').trim(),
              stage: String(item.code || item.statusCode || item.status_code || '').trim(),
            });
          }
        }
        walk(item, depth + 1);
      }
      return;
    }
    if (typeof node === 'object') {
      for (const v of Object.values(node)) walk(v, depth + 1);
    }
  }

  walk(json);
  const seen = new Set();
  return events.filter((e) => {
    const key = `${e.time}|${e.status}|${e.location}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return !!e.status;
  });
}
