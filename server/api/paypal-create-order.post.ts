// server/api/paypal-create-order.post.ts
// Create PayPal order server-side (secret never exposed to browser)

import { paypalCreateOrder, paypalGetAccessToken } from '../utils/paypal';

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
    return_url?: string;
    cancel_url?: string;
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
  const amountValue = num.toFixed(2);
  const currency = (body?.currency || 'THB').toUpperCase();

  try {
    const token = await paypalGetAccessToken(clientId, clientSecret, env);
    const order = await paypalCreateOrder(token, env, {
      woocommerceOrderId: wcId,
      amountValue,
      currencyCode: currency,
      returnUrl: body?.return_url,
      cancelUrl: body?.cancel_url,
    });
    return { id: order.id, woocommerce_order_id: wcId };
  } catch (e: any) {
    console.error('[paypal-create-order]', e?.message || e);
    throw createError({
      statusCode: 502,
      message: e?.message || 'Failed to create PayPal order',
    });
  }
});
