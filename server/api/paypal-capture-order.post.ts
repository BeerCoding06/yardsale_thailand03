// server/api/paypal-capture-order.post.ts
// Capture หลังผู้ใช้อนุมัติใน PayPal แล้วอัปเดต WooCommerce เป็น processing

import { paypalCaptureOrder, paypalGetAccessToken } from '../utils/paypal';
import { paypalLogError, paypalLogEvent, paypalLogWarn } from '../utils/paypal-log';
import * as wpUtils from '../utils/wp';
import { woocommercePutOrderProcessing } from '../utils/woocommerce-order';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const clientId = config.public.paypalClientId || process.env.PAYPAL_CLIENT_ID;
  const clientSecret = config.paypalClientSecret || process.env.PAYPAL_CLIENT_SECRET;
  const env = (config.paypalEnvironment || process.env.PAYPAL_ENVIRONMENT || 'sandbox') as 'sandbox' | 'live';
  /** ตรงกับ WordPress `ORDER_PAID_SECRET` (หรือ define เก่าใน plugin) — Dokploy: `ORDER_PAID_SECRET` หรือ `NUXT_ORDER_PAID_SECRET` */
  const orderPaidSecret =
    process.env.ORDER_PAID_SECRET ||
    process.env.NUXT_ORDER_PAID_SECRET ||
    (config.orderPaidSecret as string) ||
    '';

  if (!clientId || !clientSecret) {
    throw createError({ statusCode: 500, message: 'PayPal credentials not configured' });
  }

  const body = await readBody(event) as {
    orderID?: string;
    paypal_order_id?: string;
    woocommerce_order_id?: number | string;
    woocommerceOrderId?: number | string;
  };
  const paypalOrderId = body?.orderID || body?.paypal_order_id;
  if (!paypalOrderId || typeof paypalOrderId !== 'string') {
    throw createError({ statusCode: 400, message: 'orderID (PayPal order id) is required' });
  }
  const rawWc = body?.woocommerce_order_id ?? body?.woocommerceOrderId;
  const wcIdFromClient =
    typeof rawWc === 'string' ? parseInt(rawWc, 10) : Number(rawWc);
  if (!Number.isFinite(wcIdFromClient) || wcIdFromClient < 1) {
    paypalLogError(
      'capture_missing_woocommerce_order_id',
      'POST body must include woocommerce_order_id (minimal PayPal orders do not use purchase_units[].custom_id)',
      { paypal_order_id: paypalOrderId }
    );
    throw createError({
      statusCode: 400,
      message:
        'woocommerce_order_id is required in JSON body — redeploy app + hard-refresh so PayPal button sends it with capture',
    });
  }

  try {
    const token = await paypalGetAccessToken(clientId, clientSecret, env);
    const result = await paypalCaptureOrder(token, env, paypalOrderId);

    let woocommerceOrderId = wcIdFromClient;
    if (result.woocommerceOrderId && result.woocommerceOrderId > 0) {
      if (result.woocommerceOrderId !== wcIdFromClient) {
        throw createError({
          statusCode: 400,
          message: 'woocommerce_order_id does not match PayPal order metadata',
        });
      }
      woocommerceOrderId = result.woocommerceOrderId;
    }

    const captureOk = String(result.status || '').toUpperCase() === 'COMPLETED';
    if (!captureOk) {
      paypalLogWarn('capture_unexpected_status', `status=${result.status}`, {
        paypal_order_id: paypalOrderId,
        paypal_status: result.status,
        woocommerce_order_id: woocommerceOrderId,
      });
      console.warn('[paypal-capture-order] Unexpected status:', result.status);
      throw createError({
        statusCode: 400,
        statusMessage: `PayPal capture status: ${result.status}`,
        message: `PayPal capture status: ${result.status} (expected COMPLETED)`,
        data: { paypal_status: result.status, paypal_order_id: paypalOrderId },
      });
    }

    const hasWcRestCreds =
      Boolean(wpUtils.getWpConsumerKey()?.trim()) && Boolean(wpUtils.getWpConsumerSecret()?.trim());

    /** Primary: WooCommerce REST PUT (consumer key + secret). Fallback: yardsale/v1/order-paid + ORDER_PAID_SECRET */
    if (hasWcRestCreds) {
      const wcRes = await woocommercePutOrderProcessing(woocommerceOrderId, {
        transactionId: result.captureId ?? undefined,
      });
      if (wcRes.ok) {
        paypalLogEvent('capture_ok', {
          paypal_order_id: result.paypalOrderId,
          capture_id: result.captureId ?? undefined,
          woocommerce_order_id: woocommerceOrderId,
          paypal_environment: env,
          woocommerce_updated: true,
          woocommerce_update_method: 'wc_rest_put',
        });
        return {
          success: true,
          paypal: { ...result, woocommerceOrderId },
          woocommerce_updated: true,
          woocommerce_order_id: woocommerceOrderId,
          woocommerce_update_method: 'wc_rest_put',
        };
      }

      paypalLogError('wc_rest_put_failed', wcRes.errorLabel || 'WooCommerce PUT failed', {
        paypal_order_id: result.paypalOrderId,
        woocommerce_order_id: woocommerceOrderId,
        wc_http_status: wcRes.httpStatus,
        wc_body_preview: wcRes.rawBody.slice(0, 500),
      });

      if (!orderPaidSecret) {
        throw createError({
          statusCode: 502,
          message: 'Payment captured but WooCommerce REST update failed and no ORDER_PAID_SECRET for fallback',
          data: {
            paypal: result,
            wc_status: wcRes.httpStatus,
            wc_body: wcRes.rawBody.slice(0, 2000),
            wc_error: wcRes.errorLabel,
          },
        });
      }

      paypalLogWarn('wc_rest_fallback_order_paid', 'WC REST failed; trying yardsale/v1/order-paid', {
        woocommerce_order_id: woocommerceOrderId,
        wc_http_status: wcRes.httpStatus,
      });
    } else if (!orderPaidSecret) {
      paypalLogWarn(
        'capture_ok_woocommerce_skipped',
        'No WC REST keys and no ORDER_PAID_SECRET — set WP_CONSUMER_KEY + WP_CONSUMER_SECRET and/or ORDER_PAID_SECRET',
        {
          paypal_order_id: result.paypalOrderId,
          capture_id: result.captureId ?? undefined,
          woocommerce_order_id: woocommerceOrderId,
        }
      );
      console.error(
        '[paypal-capture-order] WooCommerce not updated: set WP_CONSUMER_KEY + WP_CONSUMER_SECRET (REST) or ORDER_PAID_SECRET (plugin order-paid)'
      );
      return {
        success: true,
        paypal: result,
        woocommerce_updated: false,
        warning_code: 'MISSING_WOOCOMMERCE_UPDATE_CONFIG',
        warning:
          'PayPal captured but WooCommerce not updated: set WP_CONSUMER_KEY + WP_CONSUMER_SECRET for REST API, or ORDER_PAID_SECRET for plugin fallback. See docs/PAYPAL-INTEGRATION.md',
      };
    }

    const wpBaseUrl = wpUtils.getWpBaseUrl();
    const url = `${wpBaseUrl}/wp-json/yardsale/v1/order-paid`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: woocommerceOrderId,
        secret: orderPaidSecret,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    if (!res.ok) {
      paypalLogError('order_paid_http_failed', `${res.status} ${text.slice(0, 200)}`, {
        paypal_order_id: result.paypalOrderId,
        woocommerce_order_id: woocommerceOrderId,
        wp_http_status: res.status,
      });
      console.error('[paypal-capture-order] order-paid failed:', res.status, text);
      throw createError({
        statusCode: 502,
        message: 'Payment captured but WooCommerce update failed (order-paid)',
        data: { paypal: result, wp_status: res.status, wp_body: text },
      });
    }

    paypalLogEvent('capture_ok', {
      paypal_order_id: result.paypalOrderId,
      capture_id: result.captureId ?? undefined,
      woocommerce_order_id: woocommerceOrderId,
      paypal_environment: env,
      woocommerce_updated: true,
      woocommerce_update_method: 'yardsale_order_paid',
    });
    return {
      success: true,
      paypal: { ...result, woocommerceOrderId },
      woocommerce_updated: true,
      woocommerce_order_id: woocommerceOrderId,
      woocommerce_update_method: 'yardsale_order_paid',
    };
  } catch (e: any) {
    if (e?.statusCode) throw e;
    paypalLogError('capture_failed', e?.message || String(e), {
      paypal_order_id: paypalOrderId,
      paypal_environment: env,
    });
    console.error('[paypal-capture-order]', e?.message || e);
    throw createError({
      statusCode: 502,
      message: e?.message || 'PayPal capture failed',
    });
  }
});
