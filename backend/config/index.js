import dotenv from 'dotenv';

dotenv.config();

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
};
