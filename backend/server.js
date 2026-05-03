import app from './app.js';
import { config } from './config/index.js';
import * as orderService from './services/order.service.js';
import {
  oauthFacebookConfigured,
  oauthGoogleConfigured,
  oauthLineConfigured,
} from './config/passport.config.js';
import { ensureWalletSchemaOnStartup } from './bootstrap/ensureWalletSchema.js';
import { ensureBuyerWalletSchemaOnStartup } from './bootstrap/ensureBuyerWalletSchema.js';
import { ensureRefundRequestEvidenceColumnOnStartup } from './bootstrap/ensureRefundRequestEvidence.js';
import { ensureSupportChatSchemaOnStartup } from './bootstrap/ensureSupportChatSchema.js';

/** ผูก 0.0.0.0 — ใน Docker healthcheck ใช้ 127.0.0.1; ถ้าฟังเฉพาะ :: บาง image จะไม่รับ IPv4 loopback */
const host = String(process.env.HOST || '0.0.0.0').trim() || '0.0.0.0';

async function main() {
  await ensureBuyerWalletSchemaOnStartup();
  await ensureRefundRequestEvidenceColumnOnStartup();
  await ensureWalletSchemaOnStartup();
  await ensureSupportChatSchemaOnStartup();
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

    if (config.autoCancelUnshipped.enabled) {
      const intervalMinutes = Math.max(1, Number(config.autoCancelUnshipped.intervalMinutes) || 60);
      const intervalMs = intervalMinutes * 60 * 1000;
      const runAutoCancel = async () => {
        try {
          const result = await orderService.triggerAutoCancelUnshippedOrders(null);
          console.info('[server] auto-cancel unshipped orders completed', {
            checked: result.checked,
            results: Array.isArray(result.results) ? result.results.length : 0,
          });
        } catch (err) {
          console.error('[server] auto-cancel unshipped orders failed', err);
        }
      };

      console.info(`[server] auto-cancel unshipped orders enabled; interval=${intervalMinutes}min`);
      runAutoCancel().catch((err) => console.error('[server] auto-cancel startup failed', err));
      setInterval(runAutoCancel, intervalMs);
    }
  });
}

main().catch((e) => {
  console.error('[server] startup failed', e);
  process.exit(1);
});
