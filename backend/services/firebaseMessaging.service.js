import fs from 'fs';
import https from 'https';
import { URL } from 'url';
import { GoogleAuth } from 'google-auth-library';
import { config } from '../config/index.js';

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

export function isFcmConfigured() {
  const p = config.fcm.credentialsPath;
  const j = config.fcm.credentialsJson;
  if (j) return true;
  return Boolean(p && fs.existsSync(p));
}

function parseCredentialsObject() {
  const j = config.fcm.credentialsJson;
  if (j) {
    try {
      return JSON.parse(j);
    } catch {
      return null;
    }
  }
  const p = config.fcm.credentialsPath;
  if (p && fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

function readProjectIdFromCredentials() {
  const obj = parseCredentialsObject();
  if (obj && obj.project_id) return String(obj.project_id).trim();
  return '';
}

export function resolveFcmProjectId() {
  return config.fcm.projectId || readProjectIdFromCredentials();
}

async function getAccessToken() {
  const credObj = parseCredentialsObject();
  const p = config.fcm.credentialsPath;
  const authOpts =
    credObj && typeof credObj === 'object'
      ? { credentials: credObj, scopes: [SCOPE] }
      : p && fs.existsSync(p)
        ? { keyFile: p, scopes: [SCOPE] }
        : null;
  if (!authOpts) {
    throw new Error('Missing FIREBASE_CREDENTIALS (path) or FIREBASE_CREDENTIALS_JSON');
  }
  const auth = new GoogleAuth(authOpts);
  const client = await auth.getClient();
  const res = await client.getAccessToken();
  if (!res.token) throw new Error('No access token from Google');
  return res.token;
}

function stringifyData(data) {
  const out = {};
  if (!data || typeof data !== 'object') return out;
  for (const [k, v] of Object.entries(data)) {
    out[String(k)] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  return out;
}

/** POST JSON ผ่าน https (ไม่ใช้ fetch — รองรับ Node ที่ไม่มี global fetch) */
function postJson(urlStr, authHeader, jsonBody) {
  const payload = JSON.stringify(jsonBody);
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const opts = {
      hostname: u.hostname,
      port: u.port || 443,
      path: `${u.pathname}${u.search}`,
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload, 'utf8'),
      },
    };
    const req = https.request(opts, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        let json = {};
        if (raw) {
          try {
            json = JSON.parse(raw);
          } catch {
            json = { raw };
          }
        }
        resolve({ status: res.statusCode || 0, json });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * ส่งทีละ token (FCM v1 ไม่มี batch ใน endpoint เดียวแบบ legacy)
 * @param {string[]} tokens
 * @param {string} title
 * @param {string} body
 * @param {Record<string, unknown>} [data]
 */
export async function sendToDevices(tokens, title, body, data = {}) {
  if (!isFcmConfigured()) {
    throw new Error(
      'FCM is not configured (set FIREBASE_CREDENTIALS path or FIREBASE_CREDENTIALS_JSON)'
    );
  }
  const projectId = resolveFcmProjectId();
  if (!projectId) {
    throw new Error('Missing FIREBASE_PROJECT_ID (or project_id inside service account JSON)');
  }
  const accessToken = await getAccessToken();
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const dataPayload = stringifyData(data);
  const results = [];

  for (const token of tokens) {
    const { status, json } = await postJson(
      url,
      `Bearer ${accessToken}`,
      {
        message: {
          token,
          notification: { title, body },
          data: dataPayload,
        },
      }
    );
    results.push({ token, ok: status >= 200 && status < 300, status, response: json });
  }

  return results;
}
