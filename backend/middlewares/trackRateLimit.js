/**
 * Simple in-memory rate limit for POST /api/track (per IP).
 * 17TRACK allows ~3 req/s account-wide; this protects our API from abuse.
 */
const buckets = new Map();

const WINDOW_MS = 60_000;
const MAX = Number(process.env.TRACK_API_RATE_LIMIT_PER_MINUTE || 30);

function bucketKey(req) {
  const xf = req.headers['x-forwarded-for'];
  const ip = typeof xf === 'string' ? xf.split(',')[0].trim() : req.socket?.remoteAddress || 'unknown';
  return ip;
}

export function trackRateLimit(req, res, next) {
  const key = bucketKey(req);
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.start > WINDOW_MS) {
    b = { start: now, count: 0 };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count > MAX) {
    res.set('Retry-After', String(Math.ceil(WINDOW_MS / 1000)));
    return res.status(429).json({
      success: false,
      error: {
        message: 'Too many tracking requests. Please try again later.',
        code: 'TRACK_API_RATE_LIMIT',
      },
    });
  }
  next();
}
