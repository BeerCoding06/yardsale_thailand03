import dotenv from 'dotenv';

dotenv.config();

function envFlag(name) {
  const v = String(process.env[name] ?? '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
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
};
