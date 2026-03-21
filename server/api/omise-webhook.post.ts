// server/api/omise-webhook.post.ts
// รับ Webhook จาก Omise เมื่อชำระสำเร็จ → อัปเดตออเดอร์ใน WooCommerce เป็น processing

import * as wpUtils from '../utils/wp';
import crypto from 'crypto';

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig();
    const webhookSecret =
      config.omiseWebhookSecret ||
      process.env.OMISE_WEBHOOK_SECRET ||
      process.env.NUXT_OMISE_WEBHOOK_SECRET ||
      '';
    const orderPaidSecret =
      process.env.ORDER_PAID_SECRET ||
      process.env.NUXT_ORDER_PAID_SECRET ||
      (config.orderPaidSecret as string) ||
      process.env.OMISE_ORDER_PAID_SECRET ||
      process.env.NUXT_OMISE_ORDER_PAID_SECRET ||
      webhookSecret;
    const rawBody = await readRawBody(event);
    if (!rawBody) {
      throw createError({ statusCode: 400, message: 'Empty body' });
    }

    const signature = getHeader(event, 'omise-signature') || getHeader(event, 'Omise-Signature') || '';
    if (webhookSecret && signature) {
      const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
      const received = signature.replace(/^sha256=/, '');
      if (expected !== received) {
        console.error('[omise-webhook] Invalid signature');
        throw createError({ statusCode: 401, message: 'Invalid signature' });
      }
    }

    const payload = JSON.parse(rawBody) as { object?: string; key?: string; data?: { object?: string; status?: string; metadata?: { order_id?: string } } };
    if (payload.object !== 'event') {
      return { received: true };
    }
    const key = payload.key; // e.g. charge.complete
    const data = (payload as any).data;
    if (!data || data.object !== 'charge') {
      return { received: true };
    }
    // Omise ส่ง status เป็น 'successful' เมื่อชำระสำเร็จ
    if (data.status !== 'successful') {
      console.log('[omise-webhook] Ignored event', key, 'charge status:', data.status);
      return { received: true };
    }
    const order_id = data.metadata?.order_id;
    if (!order_id) {
      console.warn('[omise-webhook] charge.successful but no metadata.order_id');
      return { received: true };
    }

    const wpBaseUrl = wpUtils.getWpBaseUrl();
    const url = `${wpBaseUrl}/wp-json/yardsale/v1/order-paid`;
    console.log('[omise-webhook] Calling order-paid for order_id=', order_id, 'url=', url);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: Number(order_id), secret: orderPaidSecret }),
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error('[omise-webhook] order-paid failed:', res.status, text);
      throw createError({ statusCode: 502, message: 'Failed to update order' });
    }
    console.log('[omise-webhook] Order', order_id, 'WooCommerce updated successfully');
    return { received: true, order_id: Number(order_id) };
  } catch (e: any) {
    if (e?.statusCode) throw e;
    console.error('[omise-webhook] Error:', e?.message || e);
    throw createError({ statusCode: 500, message: e?.message || 'Webhook error' });
  }
});
