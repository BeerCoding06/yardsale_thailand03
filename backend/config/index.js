import dotenv from 'dotenv';

dotenv.config();

function envFlag(name) {
  const v = String(process.env[name] ?? '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** ต้นทาง public ของเว็บ (ไม่มี path /auth) — โค้ดต่อท้ายเป็น /auth/google/callback เอง */
function normalizeOAuthCallbackBase(raw) {
  let s = String(raw || '')
    .trim()
    .replace(/\/+$/, '');
  if (s.endsWith('/auth')) {
    s = s.slice(0, -'/auth'.length).replace(/\/+$/, '');
  }
  return s;
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-only-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  publicUploadBase: process.env.PUBLIC_UPLOAD_BASE || '/uploads',
  slipok: {
    branchId: process.env.SLIPOK_BRANCH_ID || '',
    apiKey: process.env.SLIPOK_API_KEY || '',
    apiBase: process.env.SLIPOK_API_BASE || 'https://api.slipok.com',
    defaultLog: process.env.SLIPOK_LOG_DEFAULT || 'true',
  },
  /** 17TRACK Tracking API v2.4 — https://api.17track.net */
  seventeenTrack: {
    apiKey: process.env.SEVENTEEN_TRACK_API_KEY || '',
    baseUrl: (process.env.SEVENTEEN_TRACK_BASE_URL || 'https://api.17track.net').replace(/\/$/, ''),
  },
  /**
   * Firebase Cloud Messaging HTTP v1
   * - FIREBASE_CREDENTIALS = path ไฟล์ JSON (local / volume mount)
   * - FIREBASE_CREDENTIALS_JSON = เนื้อหา JSON ทั้งก้อน (เหมาะ Dokploy secret ไม่ต้อง mount ไฟล์)
   */
  fcm: {
    credentialsPath: (process.env.FIREBASE_CREDENTIALS || '').trim(),
    credentialsJson: (process.env.FIREBASE_CREDENTIALS_JSON || '').trim(),
    projectId: (process.env.FIREBASE_PROJECT_ID || '').trim(),
    clientEmail: (process.env.FIREBASE_CLIENT_EMAIL || '').trim(),
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').trim(),
  },
  /** URL หน้าเว็บหลัก (ลิงก์ใน push) — ไม่ตั้ง = ใช้ origin แรกจาก CORS_ORIGINS หรือ localhost */
  publicWebUrl: (() => {
    const u = (process.env.PUBLIC_WEB_URL || '').trim().replace(/\/$/, '');
    if (u) return u;
    const raw = (process.env.CORS_ORIGINS || '').split(',')[0]?.trim().replace(/\/$/, '');
    if (raw) return raw;
    return 'http://localhost:3000';
  })(),
  /**
   * บรรทัด log [payment-audit] … สำหรับไล่ production (ไม่ล็อก slip/base64)
   * เปิดชั่วคราว: PAYMENT_AUDIT_LOG=1
   */
  paymentAuditLog: envFlag('PAYMENT_AUDIT_LOG'),
  /** Google / Facebook / LINE OAuth — ดู docs/SOCIAL_AUTH_SETUP.md */
  oauth: {
    callbackBase: (() => {
      const raw = normalizeOAuthCallbackBase(process.env.OAUTH_CALLBACK_BASE || '');
      if (raw) return raw;
      const port = Number(process.env.PORT) || 4000;
      return `http://127.0.0.1:${port}`;
    })(),
    frontendSuccessUrl: (() => {
      const u = (process.env.OAUTH_FRONTEND_SUCCESS_URL || '').trim();
      if (u) return u;
      return 'http://localhost:3000/auth/callback';
    })(),
    frontendFailureUrl: (process.env.OAUTH_FRONTEND_FAILURE_URL || '').trim(),
    sessionSecret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'dev-only-change-me',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'dev-only-change-me',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    google: {
      clientId: (process.env.GOOGLE_CLIENT_ID || '').trim(),
      clientSecret: (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
    },
    facebook: {
      appId: (process.env.FACEBOOK_APP_ID || '').trim(),
      appSecret: (process.env.FACEBOOK_APP_SECRET || '').trim(),
    },
    line: {
      channelId: (process.env.LINE_CHANNEL_ID || '').trim(),
      channelSecret: (process.env.LINE_CHANNEL_SECRET || '').trim(),
    },
  },
};
