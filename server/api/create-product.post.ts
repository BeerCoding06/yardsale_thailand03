// server/api/create-product.post.ts
// Create product: prefer WordPress plugin endpoint (JWT) so it runs as the user; fallback to PHP script

import * as wpUtils from '../utils/wp';
import { executePhpScript } from '../utils/php-executor';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    const authHeader = getHeader(event, 'authorization') || getHeader(event, 'Authorization');
    const jwt = authHeader?.replace(/^Bearer\s+/i, '').trim() || body?.token || null;

    // When JWT is present, use ONLY the WordPress plugin (no fallback to PHP - PHP uses WC REST API and returns 403)
    if (jwt) {
      const wpBaseUrl = wpUtils.getWpBaseUrl();
      const url = `${wpBaseUrl}/wp-json/yardsale/v1/create-product`;
      const payload = { ...body };
      delete payload.token;

      console.log('[create-product] Calling WordPress plugin (JWT):', url);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.success !== false) {
        console.log('[create-product] Plugin created product:', data?.product?.id);
        return data;
      }

      const errMsg =
        data?.message ||
        data?.error?.message ||
        (typeof data?.error === 'string' ? data.error : null) ||
        data?.code ||
        res.statusText ||
        'WordPress plugin request failed';

      // If plugin says WooCommerce not installed, fall back to PHP (REST API) so create still works
      if (res.status === 500 && String(errMsg).toLowerCase().includes('woocommerce') && String(errMsg).toLowerCase().includes('not installed')) {
        console.warn('[create-product] Plugin: WooCommerce not loaded, falling back to PHP script');
      } else {
        console.error('[create-product] Plugin error:', res.status, errMsg);
        throw createError({
          statusCode: res.status >= 400 ? res.status : 502,
          message: errMsg,
        });
      }
    }

    // No JWT: use PHP script (consumer key or Basic Auth)
    console.log('[create-product] Executing PHP script: createProduct.php');
    const data = await executePhpScript({
      script: 'createProduct.php',
      body: body,
      method: 'POST',
    });

    console.log('[create-product] Successfully created product:', data?.product?.id);
    return data;
  } catch (error: any) {
    console.error('[create-product] Error:', error);

    if (error?.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      message: error?.message || 'Failed to create product',
    });
  }
});
