import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';

const AUTH_URL = 'https://trackapi.thailandpost.co.th/post/api/v1/authenticate/token';
const TRACK_URL = 'https://trackapi.thailandpost.co.th/post/api/v1/track';
const CARRIER_NAME = 'Thailand Post';

/** In-memory access token cache (Thailand Post tokens are short-lived). */
let cachedAccessToken = null;
let tokenExpiresAtMs = 0;

/**
 * Thailand Post barcodes: EMS / registered mail (e.g. EQ191963463TH).
 * @param {string} trackingNumber
 */
export function isThailandPostBarcode(trackingNumber) {
  const tn = String(trackingNumber || '')
    .trim()
    .toUpperCase();
  return /^[A-Z]{2}\d{9}TH$/.test(tn);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Parse Buddhist-era datetime from Thailand Post API (e.g. "30/05/2569 11:59+07:00").
 * @param {string | null | undefined} dateStr
 * @returns {string | null} ISO string
 */
export function parseThaiPostDate(dateStr) {
  if (!dateStr) return null;
  const raw = String(dateStr).trim();
  const m = raw.match(
    /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s*([+-]\d{2}:\d{2})?$/
  );
  if (!m) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const [, dd, mm, buddhistYear, hh, mi, ss = '00', tz = '+07:00'] = m;
  const year = parseInt(buddhistYear, 10) - 543;
  const iso = `${year}-${mm}-${dd}T${hh}:${mi}:${ss}${tz}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function mapStatusCodeToShippingStatus(statusCode, deliveryStatus, statusDescription = '') {
  const code = parseInt(String(statusCode || ''), 10);
  const delivery = String(deliveryStatus || '')
    .trim()
    .toUpperCase();
  const text = String(statusDescription || '').toLowerCase();

  if (code === 501 || delivery === 'S' || /นำจ่ายสำเร็จ|final delivery|delivered/.test(text)) {
    return 'delivered';
  }
  if (
    code === 301 ||
    code === 302 ||
    /ออกไปนำจ่าย|อยู่ระหว่างการนำจ่าย|out for (physical )?delivery|item out for/.test(text)
  ) {
    return 'out_for_delivery';
  }
  if (
    (code >= 201 && code <= 207) ||
    /ระหว่างขนส่ง|in transit|ส่งออก|arrival|customs|transit|คัดแยก/.test(text)
  ) {
    return 'shipped';
  }
  if (
    (code >= 101 && code <= 103) ||
    /รับฝาก|รับเข้า|posting|collection|preload|accepted/.test(text)
  ) {
    return 'preparing';
  }
  if (code === 401) return 'shipped';
  if (code === 203) return 'shipped';
  return 'shipped';
}

function parseUpstreamJson(text, { phase = 'request' } = {}) {
  if (!text || !String(text).trim()) {
    throw new AppError(
      `Thailand Post ${phase} returned empty body`,
      502,
      'TRACKING_UPSTREAM_INVALID'
    );
  }
  const raw = String(text).trim();
  if (raw.startsWith('<!') || raw.startsWith('<html')) {
    throw new AppError(
      'Thailand Post API key is invalid or rejected (upstream returned HTML). Check THAILAND_POST_API_KEY length is 100 and $ characters are not stripped by Docker Compose (use $$ in .env).',
      502,
      'TRACKING_UPSTREAM_AUTH'
    );
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new AppError(
      `Thailand Post ${phase} returned non-JSON (HTTP body starts with: ${raw.slice(0, 80)})`,
      502,
      'TRACKING_UPSTREAM_INVALID'
    );
  }
}

async function fetchAccessToken() {
  const apiKey = config.thailandPost.apiKey;
  if (!apiKey) {
    throw new AppError('Thailand Post tracking is not configured', 503, 'TRACKING_NOT_CONFIGURED');
  }

  const now = Date.now();
  if (cachedAccessToken && tokenExpiresAtMs > now + 60_000) {
    return cachedAccessToken;
  }

  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Token ${apiKey}`,
    },
  });

  const text = await res.text();
  const json = parseUpstreamJson(text, { phase: 'auth' });

  if (!res.ok) {
    throw new AppError(
      `Thailand Post auth HTTP ${res.status}`,
      res.status === 401 ? 502 : 502,
      'TRACKING_UPSTREAM_AUTH'
    );
  }

  const token = json?.token || json?.access_token;
  if (!token) {
    throw new AppError('Thailand Post auth returned no token', 502, 'TRACKING_UPSTREAM_AUTH');
  }

  cachedAccessToken = String(token);
  const expiresInSec = Number(json?.expire_in ?? json?.expires_in ?? 3600);
  tokenExpiresAtMs = now + (Number.isFinite(expiresInSec) ? expiresInSec : 3600) * 1000;
  return cachedAccessToken;
}

async function postTrack(body, { retries = 2 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const accessToken = await fetchAccessToken();
    const res = await fetch(TRACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    const json = parseUpstreamJson(text, { phase: 'track' });

    if (res.status === 401 && attempt < retries) {
      cachedAccessToken = null;
      tokenExpiresAtMs = 0;
      lastErr = new AppError('Thailand Post rejected access token', 502, 'TRACKING_UPSTREAM_AUTH');
      await sleep(300);
      continue;
    }

    if (res.status === 429) {
      throw new AppError('Thailand Post rate limit exceeded', 429, 'TRACKING_UPSTREAM_RATE_LIMIT');
    }

    if (!res.ok) {
      throw new AppError(
        `Thailand Post HTTP ${res.status}`,
        502,
        'TRACKING_UPSTREAM_ERROR'
      );
    }

    return json;
  }
  throw lastErr || new AppError('Thailand Post request failed', 502, 'TRACKING_UPSTREAM_ERROR');
}

function normalizeEvents(itemsForBarcode) {
  const rows = Array.isArray(itemsForBarcode) ? itemsForBarcode : [];
  const events = rows.map((row) => ({
    timeUtc: parseThaiPostDate(row.status_date || row.delivery_datetime),
    status: String(row.status_description || row.delivery_description || row.status || '').trim(),
    location: String(row.location || '').trim(),
    stage: String(row.status || '').trim(),
    statusCode: String(row.status || '').trim(),
    deliveryStatus: row.delivery_status ?? null,
    receiverName: row.receiver_name ?? null,
  }));

  events.sort((a, b) => String(b.timeUtc || '').localeCompare(String(a.timeUtc || '')));
  return events;
}

function normalizeTrackResponse(trackingNumber, upstream, language = 'TH') {
  const tn = String(trackingNumber || '').trim().toUpperCase();
  const items = upstream?.response?.items || {};
  const rawRows = items[tn] || items[tn.toLowerCase()] || [];
  const events = normalizeEvents(rawRows);
  const latest = events[0] || {};

  const currentStatus =
    String(latest.status || '').trim() ||
    (rawRows.length ? 'No status yet' : 'No tracking information available yet');

  const updatedAt = latest.timeUtc || null;

  const trackingHistory = events.map((e) => ({
    time: e.timeUtc,
    status: e.status,
    location: e.location,
    stage: e.stage,
  }));

  return {
    trackingNumber: tn,
    carrier: CARRIER_NAME,
    carrierCode: null,
    provider: 'thailand_post',
    currentStatus,
    updatedAt,
    trackingHistory,
    language,
    _rawItem: upstream,
    _latestEvent: latest,
  };
}

/**
 * แปลงผล Thailand Post → shipping_status ของออเดอร์
 */
export function mapNormalizedToShippingStatus(normalized) {
  if (!normalized) return 'shipped';
  const latest = normalized._latestEvent || {};
  if (latest.statusCode || latest.deliveryStatus) {
    return mapStatusCodeToShippingStatus(
      latest.statusCode,
      latest.deliveryStatus,
      latest.status
    );
  }

  const events = normalized.trackingHistory || [];
  for (const ev of events) {
    const ship = mapStatusCodeToShippingStatus(ev.stage, null, ev.status);
    if (ship === 'delivered') return 'delivered';
  }
  for (const ev of events) {
    const ship = mapStatusCodeToShippingStatus(ev.stage, null, ev.status);
    if (ship === 'out_for_delivery') return 'out_for_delivery';
  }
  if (events.length > 0) {
    const newest = events[0];
    return mapStatusCodeToShippingStatus(newest.stage, null, newest.status);
  }

  const text = String(normalized.currentStatus || '').toLowerCase();
  if (/นำจ่ายสำเร็จ|delivered|final delivery/.test(text)) return 'delivered';
  if (/นำจ่าย|out for delivery/.test(text)) return 'out_for_delivery';
  if (/รับฝาก|รับเข้า|posting|collection/.test(text)) return 'preparing';
  return 'shipped';
}

async function getItemsByBarcode(trackingNumber, { language = 'TH' } = {}) {
  const tn = String(trackingNumber || '').trim().toUpperCase();
  if (!tn) {
    throw new AppError('trackingNumber is required', 400, 'VALIDATION_ERROR');
  }

  const json = await postTrack({
    barcode: [tn],
    status: 'all',
    language: language === 'EN' ? 'EN' : 'TH',
  });

  if (json?.status !== true) {
    const msg = String(json?.message || 'Thailand Post tracking failed');
    throw new AppError(msg, 502, 'TRACKING_GETINFO_FAILED');
  }

  const items = json?.response?.items || {};
  const rows = items[tn] || [];
  if (!rows.length) {
    throw new AppError('No tracking data returned', 404, 'TRACKING_NOT_FOUND');
  }

  return { normalized: normalizeTrackResponse(tn, json, language), upstream: json };
}

/**
 * เรียก Thailand Post แบบเงียบ — ใช้ตอนบันทึก fulfillment
 */
export async function tryResolveTrackingForFulfillment(trackingNumber, { language = 'TH' } = {}) {
  const tn = String(trackingNumber || '').trim();
  if (!tn || !config.thailandPost.apiKey || !isThailandPostBarcode(tn)) return null;
  try {
    return await getItemsByBarcode(tn, { language });
  } catch {
    return null;
  }
}

/**
 * POST /api/track — Thailand Post lookup
 */
export async function trackShipment({ trackingNumber, language = 'TH' }) {
  const tn = String(trackingNumber || '').trim();
  if (!tn) {
    throw new AppError('trackingNumber is required', 400, 'VALIDATION_ERROR');
  }
  if (!config.thailandPost.apiKey) {
    throw new AppError('Thailand Post tracking is not configured', 503, 'TRACKING_NOT_CONFIGURED');
  }
  if (!isThailandPostBarcode(tn)) {
    throw new AppError('Not a Thailand Post barcode', 400, 'TRACKING_NOT_THAILAND_POST');
  }

  const { normalized, upstream } = await getItemsByBarcode(tn, { language });
  return {
    trackingNumber: normalized.trackingNumber,
    carrier: normalized.carrier,
    carrierCode: normalized.carrierCode,
    provider: normalized.provider,
    currentStatus: normalized.currentStatus,
    updatedAt: normalized.updatedAt,
    trackingHistory: normalized.trackingHistory,
    upstream,
  };
}
