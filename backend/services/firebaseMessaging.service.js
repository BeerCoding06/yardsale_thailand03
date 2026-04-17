import fs from 'fs';
import admin from 'firebase-admin';
import { config } from '../config/index.js';
import { pool } from '../models/db.js';
import * as fcmTokenModel from '../models/fcmToken.model.js';

const INVALID_TOKEN_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

const RETRYABLE_CODES = new Set([
  'messaging/unavailable',
  'messaging/internal-error',
  'messaging/third-party-auth-error',
]);

let adminReady = false;

/**
 * โหลด service account จาก: FIREBASE_CREDENTIALS_JSON | FIREBASE_CREDENTIALS (ไฟล์) |
 * ชุด FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 */
export function loadServiceAccountJson() {
  const j = config.fcm.credentialsJson?.trim();
  if (j) {
    try {
      return JSON.parse(j);
    } catch {
      return null;
    }
  }
  const p = config.fcm.credentialsPath?.trim();
  if (p && fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
      return null;
    }
  }
  const projectId = (config.fcm.projectId || '').trim();
  const clientEmail = (config.fcm.clientEmail || '').trim();
  let privateKey = (config.fcm.privateKey || '').trim();
  privateKey = privateKey.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    return {
      type: 'service_account',
      project_id: projectId,
      private_key: privateKey,
      client_email: clientEmail,
    };
  }
  return null;
}

function ensureAdminApp() {
  if (adminReady) return;
  const sa = loadServiceAccountJson();
  if (!sa || !sa.project_id) {
    throw new Error(
      'FCM: set FIREBASE_CREDENTIALS / FIREBASE_CREDENTIALS_JSON or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY'
    );
  }
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: sa.project_id,
    });
  }
  adminReady = true;
}

export function isFcmConfigured() {
  try {
    const sa = loadServiceAccountJson();
    return Boolean(sa?.project_id);
  } catch {
    return false;
  }
}

export function resolveFcmProjectId() {
  const sa = loadServiceAccountJson();
  return (config.fcm.projectId || sa?.project_id || '').trim();
}

function stringifyData(data) {
  const out = {};
  if (!data || typeof data !== 'object') return out;
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    out[String(k)] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {string[]} tokens
 * @param {string} title
 * @param {string} body
 * @param {Record<string, unknown>} data
 * @param {{ image?: string, clickAction?: string }} opts
 */
async function sendMulticastChunk(tokens, title, body, data, opts) {
  ensureAdminApp();
  const messaging = admin.messaging();
  const dataPayload = stringifyData(data);
  const clickAction = opts.clickAction || dataPayload.click_action;
  if (clickAction) dataPayload.click_action = String(clickAction);

  /** @type {import('firebase-admin').messaging.MulticastMessage} */
  const multicastMessage = {
    tokens,
    notification: {
      title,
      body,
      ...(opts.image ? { imageUrl: String(opts.image) } : {}),
    },
    data: dataPayload,
  };
  if (clickAction) {
    multicastMessage.webpush = {
      fcmOptions: { link: String(clickAction) },
    };
  }

  let lastResponse = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      lastResponse = await messaging.sendEachForMulticast(multicastMessage);
      break;
    } catch (e) {
      if (attempt >= 3) throw e;
      await sleep(400 * attempt);
    }
  }
  return lastResponse;
}

/**
 * ส่ง FCM ไปหลาย token (chunk ละ 500) + ลบ token เสีย + retry ชั่วคราว
 * @param {string[]} tokens
 * @param {string} title
 * @param {string} body
 * @param {Record<string, unknown>} [data]
 * @param {{ image?: string, clickAction?: string, click_action?: string }} [opts]
 * @returns {Promise<{ token: string, ok: boolean, status: number, response: unknown }[]>}
 */
export async function sendToDevices(tokens, title, body, data = {}, opts = {}) {
  if (!isFcmConfigured()) {
    throw new Error(
      'FCM is not configured (service account JSON or PROJECT_ID+CLIENT_EMAIL+PRIVATE_KEY)'
    );
  }
  const image = opts.image || opts.imageUrl;
  const clickAction = opts.clickAction || opts.click_action || '';

  const unique = [...new Set((tokens || []).filter(Boolean))];
  const results = [];
  const invalidTokens = [];
  const chunkSize = 500;

  for (let i = 0; i < unique.length; i += chunkSize) {
    let chunk = unique.slice(i, i + chunkSize);
    let response = null;
    for (let attempt = 1; attempt <= 3 && chunk.length; attempt++) {
      try {
        response = await sendMulticastChunk(chunk, title, body, data, { image, clickAction });
      } catch (e) {
        console.error('[fcm] sendMulticastChunk error:', e?.message || e);
        if (attempt >= 3) {
          for (const t of chunk) {
            results.push({ token: t, ok: false, status: 500, response: { message: String(e?.message || e) } });
          }
          chunk = [];
          break;
        }
        await sleep(500 * attempt);
        continue;
      }

      const retryTokens = [];
      response.responses.forEach((resp, idx) => {
        const token = chunk[idx];
        if (resp.success) {
          results.push({ token, ok: true, status: 200, response: {} });
          return;
        }
        const code = resp.error?.code || '';
        if (INVALID_TOKEN_CODES.has(code)) {
          invalidTokens.push(token);
          results.push({ token, ok: false, status: 410, response: resp.error });
          return;
        }
        if (RETRYABLE_CODES.has(code)) {
          retryTokens.push(token);
          return;
        }
        results.push({ token, ok: false, status: 400, response: resp.error });
      });

      if (retryTokens.length && attempt < 3) {
        await sleep(600 * attempt);
        chunk = retryTokens;
        continue;
      }
      break;
    }
  }

  if (invalidTokens.length) {
    const client = await pool.connect();
    try {
      const n = await fcmTokenModel.deleteTokensByValues(client, invalidTokens);
      if (config.nodeEnv !== 'production') {
        console.info(`[fcm] removed ${n} invalid token(s)`);
      }
    } catch (e) {
      console.warn('[fcm] delete invalid tokens failed:', e?.message || e);
    } finally {
      client.release();
    }
  }

  return results;
}
