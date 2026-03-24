import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import apiRoutes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadAbs = path.isAbsolute(config.uploadDir)
  ? config.uploadDir
  : path.resolve(__dirname, config.uploadDir);

const app = express();

const corsOrigins =
  process.env.CORS_ORIGINS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean) || null;

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
app.use(express.json({ limit: '2mb' }));
app.use(config.publicUploadBase, express.static(uploadAbs));

app.get('/health', (_req, res) => {
  res.json({ success: true, data: { ok: true } });
});

app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
