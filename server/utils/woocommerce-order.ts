/**
 * WooCommerce REST API — update order after external payment (e.g. PayPal capture).
 * Server-only. Uses Basic Auth (consumer_key:consumer_secret) over HTTPS.
 *
 * @see https://woocommerce.github.io/woocommerce-rest-api-docs/#update-an-order
 */

import { getWpBaseUrl, getWpConsumerKey, getWpConsumerSecret } from './wp';

export type WcOrderUpdateHttpStatus = 0 | 200 | 201 | 400 | 401 | 403 | 404 | 500 | number;

export interface WooCommerceOrderUpdateResult {
  ok: boolean;
  httpStatus: WcOrderUpdateHttpStatus;
  rawBody: string;
  orderId: number;
  /** Parsed when response is JSON */
  parsed?: { id?: number; status?: string; message?: string; code?: string };
  /** Human-readable reason when ok is false */
  errorLabel?: string;
}

function safeJsonParse(text: string): WooCommerceOrderUpdateResult['parsed'] | undefined {
  try {
    return JSON.parse(text) as WooCommerceOrderUpdateResult['parsed'];
  } catch {
    return undefined;
  }
}

function classifyWcError(status: number, body: string, parsed?: WooCommerceOrderUpdateResult['parsed']): string {
  const msg = parsed?.message || parsed?.code || body.slice(0, 300);
  switch (status) {
    case 401:
      return `WooCommerce REST 401 Unauthorized — invalid consumer_key/consumer_secret or user lacks permission. ${msg}`;
    case 403:
      return `WooCommerce REST 403 Forbidden — API user cannot edit orders. ${msg}`;
    case 404:
      return `WooCommerce REST 404 — order not found (check order ID and site URL). ${msg}`;
    case 500:
      return `WooCommerce REST 500 — server/plugin error. ${msg}`;
    default:
      return `WooCommerce REST ${status}. ${msg}`;
  }
}

/**
 * PUT /wp-json/wc/v3/orders/{order_id}
 * Sets status to processing and marks order paid (WooCommerce records payment date / stock hooks).
 */
export async function woocommercePutOrderProcessing(orderId: number): Promise<WooCommerceOrderUpdateResult> {
  if (!Number.isFinite(orderId) || orderId < 1) {
    return {
      ok: false,
      httpStatus: 0,
      rawBody: '',
      orderId,
      errorLabel: 'Invalid order ID',
    };
  }

  const consumerKey = getWpConsumerKey();
  const consumerSecret = getWpConsumerSecret();
  if (!consumerKey?.trim() || !consumerSecret?.trim()) {
    return {
      ok: false,
      httpStatus: 0,
      rawBody: '',
      orderId,
      errorLabel: 'WP_CONSUMER_KEY / WP_CONSUMER_SECRET not configured (runtimeConfig or env)',
    };
  }

  const baseUrl = getWpBaseUrl();
  const url = `${baseUrl}/wp-json/wc/v3/orders/${orderId}`;

  const basic = Buffer.from(`${consumerKey}:${consumerSecret}`, 'utf8').toString('base64');

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Basic ${basic}`,
      },
      body: JSON.stringify({
        status: 'processing',
        set_paid: true,
      }),
      signal: AbortSignal.timeout(25000),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[woocommerce-order] PUT failed (network):', { orderId, url, message });
    return {
      ok: false,
      httpStatus: 0,
      rawBody: message,
      orderId,
      errorLabel: `Network error calling WooCommerce: ${message}`,
    };
  }

  const rawBody = await res.text();
  const parsed = safeJsonParse(rawBody);
  const ok = res.ok && (res.status === 200 || res.status === 201);

  if (!ok) {
    const errorLabel = classifyWcError(res.status, rawBody, parsed);
    console.error('[woocommerce-order] PUT wc/v3/orders failed — full response:', {
      orderId,
      httpStatus: res.status,
      url,
      errorLabel,
      body: rawBody.slice(0, 4000),
    });
  } else {
    console.log('[woocommerce-order] PUT wc/v3/orders OK:', {
      orderId,
      httpStatus: res.status,
      status: parsed?.status,
    });
  }

  return {
    ok,
    httpStatus: res.status,
    rawBody,
    orderId,
    parsed,
    errorLabel: ok ? undefined : classifyWcError(res.status, rawBody, parsed),
  };
}
