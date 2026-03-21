// server/api/paypal-create-order.post.ts
// Create PayPal order server-side (secret never exposed to browser)

import { paypalCreateOrder, paypalGetAccessToken } from '../utils/paypal';
import { paypalLogError, paypalLogEvent } from '../utils/paypal-log';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const clientId = config.public.paypalClientId || process.env.PAYPAL_CLIENT_ID;
  const clientSecret = config.paypalClientSecret || process.env.PAYPAL_CLIENT_SECRET;
  const env = (config.paypalEnvironment || process.env.PAYPAL_ENVIRONMENT || 'sandbox') as
    | 'sandbox'
    | 'live';

  if (!clientId || !clientSecret) {
    throw createError({ statusCode: 500, message: 'PayPal credentials not configured' });
  }

  const body = await readBody(event) as {
    woocommerce_order_id?: number;
    amount?: string | number;
    currency?: string;
  };

  const wcId = Number(body?.woocommerce_order_id);
  if (!wcId || wcId < 1) {
    throw createError({ statusCode: 400, message: 'woocommerce_order_id is required' });
  }

  const rawAmount = body?.amount;
  const num = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount ?? ''));
  if (!Number.isFinite(num) || num <= 0) {
    throw createError({ statusCode: 400, message: 'Valid amount is required' });
  }

  /** ค่าเริ่ม USD ให้ตรงกับ PayPal SDK URL ฝั่ง client (nuxt `paypalCheckoutCurrency`) */
  const requestedCurrency = (body?.currency || 'USD').toUpperCase();
  const orderCurrencyEnv = (process.env.PAYPAL_ORDER_CURRENCY || '').trim().toUpperCase();
  let currency = orderCurrencyEnv || requestedCurrency;
  let amountValue = num.toFixed(2);

  // Sandbox: THB จาก WooCommerce → ส่ง PayPal เป็น USD (แอป sandbox มักไม่รองรับ THB / ลด compliance error)
  if (orderCurrencyEnv === 'USD' && requestedCurrency === 'THB') {
    if (env !== 'sandbox') {
      throw createError({
        statusCode: 400,
        message:
          'PAYPAL_ORDER_CURRENCY=USD with THB checkout is only allowed when PAYPAL_ENVIRONMENT=sandbox',
      });
    }
    const fx = parseFloat(process.env.PAYPAL_SANDBOX_THB_TO_USD || '0.029');
    if (!Number.isFinite(fx) || fx <= 0) {
      throw createError({ statusCode: 500, message: 'Invalid PAYPAL_SANDBOX_THB_TO_USD' });
    }
    amountValue = (num * fx).toFixed(2);
    currency = 'USD';
  } else if (orderCurrencyEnv && orderCurrencyEnv !== requestedCurrency) {
    throw createError({
      statusCode: 400,
      message:
        'Currency mismatch: align body currency with PAYPAL_ORDER_CURRENCY, or use sandbox THB→USD (PAYPAL_ORDER_CURRENCY=USD + NUXT_PUBLIC_PAYPAL_CHECKOUT_CURRENCY=USD)',
    });
  }

  try {
    const token = await paypalGetAccessToken(clientId, clientSecret, env);
    const order = await paypalCreateOrder(token, env, {
      amountValue,
      currencyCode: currency,
      payPalRequestId: `wc-${wcId}-${Date.now()}`,
    });
    paypalLogEvent('create_order_ok', {
      woocommerce_order_id: wcId,
      paypal_order_id: order.id,
      paypal_currency: currency,
      paypal_amount: amountValue,
      paypal_environment: env,
      requested_currency: requestedCurrency,
      order_shape: 'minimal',
    });
    return {
      id: order.id,
      woocommerce_order_id: wcId,
      paypal_currency: currency,
      paypal_amount: amountValue,
    };
  } catch (e: any) {
    paypalLogError('create_order_failed', e?.message || String(e), {
      woocommerce_order_id: wcId,
      paypal_environment: env,
    });
    console.error('[paypal-create-order]', e?.message || e);
    throw createError({
      statusCode: 502,
      message: e?.message || 'Failed to create PayPal order',
    });
  }
});
