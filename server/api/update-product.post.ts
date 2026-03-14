// server/api/update-product.post.ts
// Update product: prefer WordPress plugin (JWT) so user edits own product; fallback to PHP

import * as wpUtils from '../utils/wp';
import { executePhpScript } from '../utils/php-executor';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    const productId = body.product_id;
    if (!productId) {
      throw createError({
        statusCode: 400,
        message: 'product_id is required',
      });
    }

    const authHeader = getHeader(event, 'authorization') || getHeader(event, 'Authorization');
    const jwt = authHeader?.replace(/^Bearer\s+/i, '').trim() || body?.token || null;

    if (jwt) {
      const wpBaseUrl = wpUtils.getWpBaseUrl();
      const url = `${wpBaseUrl}/wp-json/yardsale/v1/update-product`;
      const payload = { ...body };
      delete payload.token;

      console.log('[update-product] Calling WordPress plugin (JWT):', url);

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
        console.log('[update-product] Plugin updated product:', data?.product?.id);
        return data;
      }

      const errMsg =
        data?.message ||
        data?.error?.message ||
        (typeof data?.error === 'string' ? data.error : null) ||
        data?.code ||
        res.statusText ||
        'WordPress plugin request failed';

      if (res.status === 500 && String(errMsg).toLowerCase().includes('woocommerce') && String(errMsg).toLowerCase().includes('not installed')) {
        console.warn('[update-product] Plugin: WooCommerce not loaded, falling back to PHP script');
      } else {
        console.error('[update-product] Plugin error:', res.status, errMsg);
        throw createError({
          statusCode: res.status >= 400 ? res.status : 502,
          message: errMsg,
        });
      }
    }

    console.log('[update-product] Executing PHP script: updateProduct.php');
    const data = await executePhpScript({
      script: 'updateProduct.php',
      body: body,
      method: 'POST',
    });

    if (data?.success === false && data?.error) {
      console.error('[update-product] PHP returned error:', data.error);
      throw createError({
        statusCode: 403,
        message: data.error,
      });
    }

    console.log('[update-product] Successfully updated product:', data?.product?.id);
    return data;
  } catch (error: any) {
    console.error('[update-product] Error:', error);
    if (error?.statusCode) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: error?.message || 'Failed to update product',
    });
  }
});
