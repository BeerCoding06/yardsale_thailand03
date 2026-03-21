// server/api/paypal-capture-order.post.ts
// Capture หลังผู้ใช้อนุมัติใน PayPal แล้วอัปเดต WooCommerce เป็น processing

import { paypalCaptureOrder, paypalGetAccessToken } from '../utils/paypal';
import * as wpUtils from '../utils/wp';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const clientId = config.public.paypalClientId || process.env.PAYPAL_CLIENT_ID;
  const clientSecret = config.paypalClientSecret || process.env.PAYPAL_CLIENT_SECRET;
  const env = (config.paypalEnvironment || process.env.PAYPAL_ENVIRONMENT || 'sandbox') as 'sandbox' | 'live';
  const orderPaidSecret =
    process.env.OMISE_ORDER_PAID_SECRET ||
    config.omiseWebhookSecret ||
    process.env.OMISE_WEBHOOK_SECRET ||
    '';

  if (!clientId || !clientSecret) {
    throw createError({ statusCode: 500, message: 'PayPal credentials not configured' });
  }

  const body = await readBody(event) as { orderID?: string; paypal_order_id?: string };
  const paypalOrderId = body?.orderID || body?.paypal_order_id;
  if (!paypalOrderId || typeof paypalOrderId !== 'string') {
    throw createError({ statusCode: 400, message: 'orderID (PayPal order id) is required' });
  }

  try {
    const token = await paypalGetAccessToken(clientId, clientSecret, env);
    const result = await paypalCaptureOrder(token, env, paypalOrderId);

    if (result.status !== 'COMPLETED') {
      console.warn('[paypal-capture-order] Unexpected status:', result.status);
      throw createError({
        statusCode: 400,
        message: `PayPal capture status: ${result.status}`,
      });
    }

    if (!result.woocommerceOrderId || result.woocommerceOrderId < 1) {
      throw createError({
        statusCode: 502,
        message: 'Missing WooCommerce order id on PayPal order (custom_id)',
      });
    }

    if (!orderPaidSecret) {
      console.error('[paypal-capture-order] OMISE_ORDER_PAID_SECRET not set – WooCommerce not updated');
      return {
        success: true,
        paypal: result,
        woocommerce_updated: false,
        warning: 'Configure OMISE_ORDER_PAID_SECRET to update WooCommerce order status',
      };
    }

    const wpBaseUrl = wpUtils.getWpBaseUrl();
    const url = `${wpBaseUrl}/wp-json/yardsale/v1/order-paid`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: result.woocommerceOrderId,
        secret: orderPaidSecret,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error('[paypal-capture-order] order-paid failed:', res.status, text);
      throw createError({
        statusCode: 502,
        message: 'Payment captured but WooCommerce update failed',
        data: { paypal: result, wp_status: res.status, wp_body: text },
      });
    }

    return {
      success: true,
      paypal: result,
      woocommerce_updated: true,
      woocommerce_order_id: result.woocommerceOrderId,
    };
  } catch (e: any) {
    if (e?.statusCode) throw e;
    console.error('[paypal-capture-order]', e?.message || e);
    throw createError({
      statusCode: 502,
      message: e?.message || 'PayPal capture failed',
    });
  }
});
