import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import passport from 'passport';
import { config } from './config/index.js';
import './config/passport.config.js';
import apiRoutes from './routes/index.js';
import authSocialRoutes from './routes/auth.social.routes.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadAbs = path.isAbsolute(config.uploadDir)
  ? config.uploadDir
  : path.resolve(__dirname, config.uploadDir);

const app = express();
if (config.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

function parseCorsOrigins(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const list = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : null;
}

/** เพิ่มคู่ apex ↔ www ให้ทุก origin ที่ parse ได้ — กัน Dokploy ใส่แค่ฝั่งเดียวแล้ว www โดน CORS block */
function expandApexWwwPair(origins) {
  const out = new Set(origins);
  for (const o of origins) {
    try {
      const u = new URL(o);
      const { protocol, hostname, port } = u;
      if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) continue;
      const p = port ? `:${port}` : '';
      if (hostname.startsWith('www.')) {
        const apex = hostname.slice(4);
        if (apex) out.add(`${protocol}//${apex}${p}`);
      } else {
        out.add(`${protocol}//www.${hostname}${p}`);
      }
    } catch {
      /* ignore invalid URL */
    }
  }
  return [...out];
}

const corsOriginsList = parseCorsOrigins(process.env.CORS_ORIGINS);
const corsOrigins = corsOriginsList ? expandApexWwwPair(corsOriginsList) : null;

app.use(
  cors({
    /** ถ้าไม่ตั้ง CORS_ORIGINS ใช้ reflect origin (รองรับ localhost:3000 / 127.0.0.1:3000) */
    origin: corsOrigins?.length
      ? (origin, cb) => {
          if (!origin) return cb(null, true);
          cb(null, corsOrigins.includes(origin));
        }
      : true,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);
app.use(
  session({
    name: 'yard.oauth.sid',
    secret: config.oauth.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      httpOnly: true,
      maxAge: 15 * 60 * 1000,
    },
  })
);
app.use(passport.initialize());
app.use(express.json({ limit: '2mb' }));
app.use(config.publicUploadBase, express.static(uploadAbs));

app.get('/health', (_req, res) => {
  res.json({ success: true, data: { ok: true } });
});

app.use('/auth', authSocialRoutes);
app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
