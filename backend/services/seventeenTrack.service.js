import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import { pool } from '../models/db.js';
import * as trackingLogModel from '../models/trackingLog.model.js';

const REGISTER_PATH = '/track/v2.4/register';
const GETINFO_PATH = '/track/v2.4/gettrackinfo';

const SEVENTEEN_ERROR_HINTS = {
  '-18010001': 'IP address is not whitelisted in 17TRACK dashboard',
  '-18010002': 'Invalid 17TRACK API key',
  '-18010004': '17TRACK account is disabled',
  '-18010005': 'Unauthorized 17TRACK access',
  '-18010010': 'Invalid request data',
  '-18010011': 'Invalid field value',
  '-18010012': 'Invalid data format',
  '-18010013': 'Invalid submitted data',
  '-18010014': 'Too many tracking numbers in one request',
  '-18010015': 'Invalid field value',
  '-18019901': 'Tracking number already registered',
  '-18019902': 'Tracking number not registered yet',
  '-18019903': 'Carrier could not be detected',
  '-18019904': 'Only stopped numbers can be re-tracked',
  '-18019908': '17TRACK quota exhausted',
  '-18019909': 'No tracking information available yet',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function mapSeventeenCode(code) {
  if (code === 0 || code === '0') return null;
  const k = String(code);
  return SEVENTEEN_ERROR_HINTS[k] || `17TRACK error (${k})`;
}

function buildPayload(number, carrier) {
  const n = String(number || '').trim();
  const row = { number: n };
  if (carrier != null && carrier !== '') {
    const c = Number(carrier);
    if (Number.isFinite(c)) row.carrier = c;
  }
  return [row];
}

async function postSeventeen(path, body, { retries = 3 } = {}) {
  const apiKey = config.seventeenTrack.apiKey;
  if (!apiKey) {
    throw new AppError('Shipment tracking is not configured', 503, 'TRACKING_NOT_CONFIGURED');
  }

  const url = `${config.seventeenTrack.baseUrl}${path}`;
  let lastErr;

  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        '17token': apiKey,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new AppError('Invalid response from tracking provider', 502, 'TRACKING_UPSTREAM_INVALID');
    }

    if (res.status === 429) {
      lastErr = new AppError('Tracking provider rate limit exceeded', 429, 'TRACKING_UPSTREAM_RATE_LIMIT');
      await sleep(800 * 2 ** attempt);
      continue;
    }

    if (res.status === 401) {
      throw new AppError('Tracking provider rejected credentials', 502, 'TRACKING_UPSTREAM_AUTH');
    }

    if (!res.ok) {
      throw new AppError(
        `Tracking provider HTTP ${res.status}`,
        res.status >= 500 ? 502 : 502,
        'TRACKING_UPSTREAM_ERROR'
      );
    }

    return json;
  }

  throw lastErr || new AppError('Tracking provider rate limit', 429, 'TRACKING_UPSTREAM_RATE_LIMIT');
}

/**
 * Register is best-effort: invalid key / quota always fail fast;
 * transient register failures are ignored so gettrackinfo can still run.
 */
async function registerTrackingNumber(trackingNumber, carrier) {
  const payload = buildPayload(trackingNumber, carrier);
  let json;
  try {
    json = await postSeventeen(REGISTER_PATH, payload, { retries: 2 });
  } catch (e) {
    if (
      e instanceof AppError &&
      ['TRACKING_NOT_CONFIGURED', 'TRACKING_UPSTREAM_AUTH', 'TRACKING_UPSTREAM_RATE_LIMIT'].includes(e.code)
    ) {
      throw e;
    }
    return;
  }

  if (json.code !== 0 && json.code !== '0') {
    const code = String(json.code);
    const critical = ['-18010002', '-18010001', '-18010004', '-18010005', '-18019908'];
    if (critical.includes(code)) {
      throw new AppError(
        mapSeventeenCode(json.code) || 'Tracking registration failed',
        502,
        'TRACKING_UPSTREAM_ERROR'
      );
    }
  }
}

function collectEvents(trackInfo) {
  const providers = trackInfo?.tracking?.providers || [];
  const out = [];
  for (const p of providers) {
    const carrierLabel = p?.provider?.name || p?.provider?.alias || '';
    for (const ev of p?.events || []) {
      out.push({
        timeUtc: ev.time_utc || ev.time_iso || null,
        status: ev.description || ev.status || ev.substatus || '',
        location: ev.location || '',
        stage: ev.stage || '',
        carrierHint: carrierLabel || undefined,
      });
    }
  }
  out.sort((a, b) => String(b.timeUtc || '').localeCompare(String(a.timeUtc || '')));
  return out;
}

function normalizeAcceptedItem(item) {
  const trackingNumber = String(item?.number || '').trim();
  const carrierCode = item?.carrier ?? null;
  const ti = item?.track_info || {};

  const providers = ti.tracking?.providers || [];
  const primary = providers[0] || {};
  const carrierName =
    primary.provider?.name ||
    primary.provider?.alias ||
    (carrierCode != null ? `Carrier ${carrierCode}` : 'Unknown');

  const events = collectEvents(ti);
  const latestEvent = ti.latest_event || {};
  const latestStatus = ti.latest_status || {};

  const currentStatus =
    (latestEvent.description && String(latestEvent.description).trim()) ||
    latestStatus.substatus_descr ||
    latestStatus.status ||
    (events[0]?.status && String(events[0].status).trim()) ||
    'No status yet';

  const updatedAt =
    latestEvent.time_utc ||
    latestStatus.time_utc ||
    events[0]?.timeUtc ||
    primary.latest_sync_time ||
    null;

  const trackingHistory = events.map((e) => ({
    time: e.timeUtc,
    status: e.status,
    location: e.location,
    stage: e.stage,
  }));

  return {
    trackingNumber,
    carrier: carrierName,
    carrierCode: carrierCode != null ? Number(carrierCode) : null,
    currentStatus,
    updatedAt,
    trackingHistory,
    _rawItem: item,
  };
}

async function getTrackInfo(trackingNumber, carrier) {
  const payload = buildPayload(trackingNumber, carrier);
  const json = await postSeventeen(GETINFO_PATH, payload, { retries: 3 });

  if (json.code !== 0 && json.code !== '0') {
    const hint = mapSeventeenCode(json.code);
    const codeNum = Number(json.code);
    const status = codeNum === -18019909 ? 404 : 502;
    throw new AppError(hint || 'Failed to load tracking info', status, 'TRACKING_GETINFO_FAILED');
  }

  const accepted = json.data?.accepted || [];
  const rejected = json.data?.rejected || [];

  if (accepted.length > 0) {
    const normalized = normalizeAcceptedItem(accepted[0]);
    return { normalized, upstream: json };
  }

  if (rejected.length > 0) {
    const errCode = rejected[0]?.error?.code;
    const hint = mapSeventeenCode(errCode) || 'Tracking number rejected';
    throw new AppError(hint, 400, 'TRACKING_REJECTED');
  }

  throw new AppError('No tracking data returned', 404, 'TRACKING_NOT_FOUND');
}

/**
 * POST /api/track — register (best effort) + gettrackinfo + optional DB log.
 */
export async function trackShipment({ trackingNumber, carrier }) {
  const tn = String(trackingNumber || '').trim();
  if (!tn) {
    throw new AppError('trackingNumber is required', 400, 'VALIDATION_ERROR');
  }

  await registerTrackingNumber(tn, carrier);
  await sleep(400);

  const { normalized, upstream } = await getTrackInfo(tn, carrier);

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
    carrierCode: normalized.carrierCode,
    currentStatus: normalized.currentStatus,
    updatedAt: normalized.updatedAt,
    trackingHistory: normalized.trackingHistory,
  };
}
