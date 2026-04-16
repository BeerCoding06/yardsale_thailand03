import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/AppError.js';
import { pool } from '../models/db.js';
import * as fcmTokenModel from '../models/fcmToken.model.js';
import * as firebaseMessaging from '../services/firebaseMessaging.service.js';

export const saveToken = asyncHandler(async (req, res) => {
  const { token, device } = req.body;
  const client = await pool.connect();
  try {
    const row = await fcmTokenModel.upsertToken(client, {
      userId: req.user.id,
      token,
      device: device || 'web',
    });
    sendSuccess(res, { message: 'FCM token saved.', record: row });
  } finally {
    client.release();
  }
});

export const sendNotification = asyncHandler(async (req, res) => {
  const {
    title,
    body,
    data = {},
    user_ids: userIds = [],
    tokens: explicitTokens = [],
  } = req.body;

  if (!firebaseMessaging.isFcmConfigured()) {
    throw new AppError(
      'FCM not configured: set FIREBASE_CREDENTIALS (file path) or FIREBASE_CREDENTIALS_JSON (Dokploy secret)',
      503,
      'FCM_DISABLED'
    );
  }

  const client = await pool.connect();
  try {
    let fromDb = [];
    if (Array.isArray(userIds) && userIds.length) {
      fromDb = await fcmTokenModel.listTokensForUsers(client, userIds);
    }
    const merged = [...new Set([...(explicitTokens || []), ...fromDb].filter(Boolean))];
    if (!merged.length) {
      sendSuccess(res, { message: 'No tokens to send', sent: 0, failed: 0, results: [] });
      return;
    }

    const results = await firebaseMessaging.sendToDevices(merged, title, body, data);
    const sent = results.filter((r) => r.ok).length;
    sendSuccess(res, {
      message: 'Notifications sent',
      sent,
      failed: results.length - sent,
      results,
    });
  } finally {
    client.release();
  }
});
