import app from './app.js';
import { config } from './config/index.js';

/** ผูก 0.0.0.0 — ใน Docker healthcheck ใช้ 127.0.0.1; ถ้าฟังเฉพาะ :: บาง image จะไม่รับ IPv4 loopback */
const host = String(process.env.HOST || '0.0.0.0').trim() || '0.0.0.0';
app.listen(config.port, host, () => {
  console.info(`[server] http://${host}:${config.port}`);
});
