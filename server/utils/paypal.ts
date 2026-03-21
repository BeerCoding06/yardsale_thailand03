/**
 * PayPal REST API v2 (server-only)
 */

export type PayPalEnvironment = 'sandbox' | 'live';

function getApiBase(env: PayPalEnvironment): string {
  return env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

export async function paypalGetAccessToken(
  clientId: string,
  clientSecret: string,
  environment: PayPalEnvironment = 'sandbox'
): Promise<string> {
  const base = getApiBase(environment);
  const auth = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal token failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('PayPal token response missing access_token');
  }
  return data.access_token;
}

export interface PayPalCreateOrderInput {
  woocommerceOrderId: number;
  amountValue: string;
  currencyCode: string;
  brandName?: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export async function paypalCreateOrder(
  accessToken: string,
  environment: PayPalEnvironment,
  input: PayPalCreateOrderInput
): Promise<{ id: string }> {
  const base = getApiBase(environment);
  const ctx: Record<string, string> = {
    brand_name: input.brandName || 'Yardsale',
    user_action: 'PAY_NOW',
  };
  if (input.returnUrl) ctx.return_url = input.returnUrl;
  if (input.cancelUrl) ctx.cancel_url = input.cancelUrl;

  const body = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: `wc-${input.woocommerceOrderId}`,
        custom_id: String(input.woocommerceOrderId),
        description: `Order #${input.woocommerceOrderId}`,
        amount: {
          currency_code: input.currencyCode.toUpperCase(),
          value: input.amountValue,
        },
      },
    ],
    application_context: ctx,
  };

  const res = await fetch(`${base}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `wc-${input.woocommerceOrderId}-${Date.now()}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`PayPal create order failed: ${res.status} ${text}`);
  }
  const data = JSON.parse(text) as { id?: string };
  if (!data.id) {
    throw new Error('PayPal create order: missing id');
  }
  return { id: data.id };
}

export interface PayPalCaptureResult {
  status: string;
  paypalOrderId: string;
  woocommerceOrderId: number | null;
  captureId: string | null;
}

export async function paypalCaptureOrder(
  accessToken: string,
  environment: PayPalEnvironment,
  paypalOrderId: string
): Promise<PayPalCaptureResult> {
  const base = getApiBase(environment);
  const url = `${base}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`PayPal capture failed: ${res.status} ${text}`);
  }
  const data = JSON.parse(text) as {
    status?: string;
    id?: string;
    purchase_units?: Array<{
      custom_id?: string;
      payments?: { captures?: Array<{ id?: string }> };
    }>;
  };

  const unit = data.purchase_units?.[0];
  const customId = unit?.custom_id;
  const capture = unit?.payments?.captures?.[0];

  return {
    status: data.status || 'UNKNOWN',
    paypalOrderId: data.id || paypalOrderId,
    woocommerceOrderId: customId ? parseInt(customId, 10) : null,
    captureId: capture?.id || null,
  };
}
