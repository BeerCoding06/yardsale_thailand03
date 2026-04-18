import app from './app.js';
import { config } from './config/index.js';
import {
  oauthFacebookConfigured,
  oauthGoogleConfigured,
  oauthLineConfigured,
} from './config/passport.config.js';

/** ผูก 0.0.0.0 — ใน Docker healthcheck ใช้ 127.0.0.1; ถ้าฟังเฉพาะ :: บาง image จะไม่รับ IPv4 loopback */
const host = String(process.env.HOST || '0.0.0.0').trim() || '0.0.0.0';
app.listen(config.port, host, () => {
  console.info(`[server] http://${host}:${config.port}`);
  console.info(
    `[server] OAuth providers: Google=${oauthGoogleConfigured()} Facebook=${oauthFacebookConfigured()} LINE=${oauthLineConfigured()} | callbackBase=${config.oauth.callbackBase}`
  );
  if (!oauthGoogleConfigured()) {
    const id = !!(process.env.GOOGLE_CLIENT_ID || '').trim();
    const sec = !!(process.env.GOOGLE_CLIENT_SECRET || '').trim();
    console.warn(
      `[server] Google OAuth disabled: GOOGLE_CLIENT_ID set=${id} GOOGLE_CLIENT_SECRET set=${sec} (both required on this Node process — not only Nuxt)`
    );
  }
});
