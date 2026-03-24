import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadAbs = path.isAbsolute(config.uploadDir)
  ? config.uploadDir
  : path.resolve(path.join(__dirname, '..'), config.uploadDir);

if (!fs.existsSync(uploadAbs)) {
  fs.mkdirSync(uploadAbs, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadAbs),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin';
    cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
  },
});

export const uploadImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});
