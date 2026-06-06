import { isThailandPostBarcode } from './thailandPost.service.js';

/** @typedef {'thailand_post'|'17track'} TrackingProvider */

/**
 * @param {string | null | undefined} name
 */
export function normalizeCourierHint(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** 17TRACK carrier keys — https://res.17track.net/asset/carrier/info/apicarrier.all.json */
export const SEVENTEEN_TRACK_CARRIER = {
  DHL: 100001,
  FEDEX: 100003,
  FLASH_TH: 100235,
  KERRY_TH: 100236,
  JT_TH: 100271,
};

/**
 * @param {string} tn
 * @param {string} hint
 * @returns {number | undefined}
 */
function guessSeventeenTrackCarrier(tn, hint) {
  if (/\bdhl\b|\bdhl\s*express\b/.test(hint) || /^JD\d{18,22}$/i.test(tn) || /^GM\d{10,}$/i.test(tn)) {
    return SEVENTEEN_TRACK_CARRIER.DHL;
  }
  if (/\bfedex\b|\bfederal\s*express\b/.test(hint)) {
    return SEVENTEEN_TRACK_CARRIER.FEDEX;
  }
  if (
    /\bflash\b|\bflashexpress\b|\bฟลาช\b/.test(hint) ||
    /^TH[A-Z0-9]{11,13}$/i.test(tn)
  ) {
    return SEVENTEEN_TRACK_CARRIER.FLASH_TH;
  }
  if (
    /\bj\s*&?\s*t\b|\bjt\s*express\b|\bจิ\s*&?\s*ที\b|\bเจ\s*&?\s*ที\b/.test(hint) ||
    /^JT[A-Z0-9]{10,18}$/i.test(tn) ||
    /^52\d{10,14}$/.test(tn)
  ) {
    return SEVENTEEN_TRACK_CARRIER.JT_TH;
  }
  if (
    /\bkerry\b|\bkex\b|\bkerry\s*express\b|\bเคอรี่\b/.test(hint) ||
    /^KEX[A-Z0-9]{8,20}$/i.test(tn) ||
    /^SHP[A-Z0-9]{10,16}$/i.test(tn)
  ) {
    return SEVENTEEN_TRACK_CARRIER.KERRY_TH;
  }
  return undefined;
}

/**
 * @param {number | undefined} code
 */
function carrierLabelFromCode(code) {
  switch (Number(code)) {
    case SEVENTEEN_TRACK_CARRIER.DHL:
      return 'DHL';
    case SEVENTEEN_TRACK_CARRIER.FEDEX:
      return 'FedEx';
    case SEVENTEEN_TRACK_CARRIER.FLASH_TH:
      return 'Flash Express';
    case SEVENTEEN_TRACK_CARRIER.KERRY_TH:
      return 'Kerry Express';
    case SEVENTEEN_TRACK_CARRIER.JT_TH:
      return 'J&T Express';
    default:
      return undefined;
  }
}

/**
 * Thailand Post → official API; ทุกขนส่งอื่น → 17TRACK
 * @returns {{ provider: TrackingProvider, seventeenTrackCarrier?: number, carrierLabel?: string }}
 */
export function resolveTrackingProvider({ trackingNumber, courierName, carrier } = {}) {
  const tn = String(trackingNumber || '')
    .trim()
    .toUpperCase();
  const hint = normalizeCourierHint(courierName);

  if (!tn) return { provider: 'unknown' };

  if (isThailandPostBarcode(tn)) {
    return { provider: 'thailand_post', carrierLabel: 'Thailand Post' };
  }

  const explicit = carrier != null && carrier !== '' ? Number(carrier) : undefined;
  const guessed = guessSeventeenTrackCarrier(tn, hint);
  const seventeenTrackCarrier =
    Number.isFinite(explicit) && explicit > 0 ? explicit : guessed;

  return {
    provider: '17track',
    seventeenTrackCarrier,
    carrierLabel: carrierLabelFromCode(seventeenTrackCarrier),
  };
}

/** URL ติดตามบนเว็บขนส่ง */
export function courierTrackingUrl(trackingNumber, courierName) {
  const tn = encodeURIComponent(String(trackingNumber || '').trim());
  if (!tn) return null;
  const route = resolveTrackingProvider({ trackingNumber, courierName });
  if (route.provider === 'thailand_post') {
    return `https://track.thailandpost.co.th/?trackNumber=${tn}`;
  }
  switch (route.carrierLabel) {
    case 'Flash Express':
      return `https://www.flashexpress.co.th/tracking/?se=${tn}`;
    case 'J&T Express':
      return `https://jtexpress.co.th/track?billcode=${tn}`;
    case 'Kerry Express':
      return `https://th.kerryexpress.com/th/track/?track=${tn}`;
    case 'DHL':
      return `https://www.dhl.com/th-th/home/tracking.html?tracking-id=${tn}&submit=1`;
    case 'FedEx':
      return `https://www.fedex.com/fedextrack/?trknbr=${tn}`;
    default:
      return `https://t.17track.net/en#nums=${tn}`;
  }
}
