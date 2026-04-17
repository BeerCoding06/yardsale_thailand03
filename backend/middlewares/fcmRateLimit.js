/**
 * Rate limit สำหรับ FCM broadcast / mass send (ต่อ user แอดมิน + per-IP)
 */
const buckets = new Map();

const WINDOW_MS = 60_000;
const MAX_BROADCAST = Number(process.env.FCM_BROADCAST_RATE_LIMIT_PER_MINUTE || 5);
const MAX_ADMIN_SEND = Number(process.env.FCM_SEND_NOTIFICATION_RATE_LIMIT_PER_MINUTE || 30);

function bucketKey(prefix, req) {
  const xf = req.headers['x-forwarded-for'];
  const ip = typeof xf === 'string' ? xf.split(',')[0].trim() : req.socket?.remoteAddress || 'unknown';
  const uid = req.user?.id || 'anon';
  return `${prefix}:${uid}:${ip}`;
}

function hitLimit(prefix, max) {
  return (req, res, next) => {
    const key = bucketKey(prefix, req);
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || now - b.start > WINDOW_MS) {
      b = { start: now, count: 0 };
      buckets.set(key, b);
    }
    b.count += 1;
    if (b.count > max) {
      res.set('Retry-After', String(Math.ceil(WINDOW_MS / 1000)));
      return res.status(429).json({
        success: false,
        error: {
          message: 'Too many FCM requests. Try again later.',
          code: 'FCM_RATE_LIMIT',
        },
      });
    }
    next();
  };
}

export const fcmBroadcastRateLimit = hitLimit('fcm-broadcast', MAX_BROADCAST);
export const fcmSendNotificationRateLimit = hitLimit('fcm-send', MAX_ADMIN_SEND);
