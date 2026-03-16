// server/api/create-order.post.ts
// สร้างออเดอร์: ถ้ามี JWT เรียก WordPress plugin (yardsale/v1/create-order) ก่อน ไม่ต้องพึ่ง WooCommerce API key

import * as wpUtils from '../utils/wp';
import { executePhpScript } from '../utils/php-executor';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event) as Record<string, unknown>;
    const authHeader = getHeader(event, 'authorization') || getHeader(event, 'Authorization');
    const jwt = (authHeader?.replace(/^Bearer\s+/i, '').trim() || body?.token || null) as string | null;

    if (jwt) {
      const wpBaseUrl = wpUtils.getWpBaseUrl();
      const url = `${wpBaseUrl}/wp-json/yardsale/v1/create-order`;
      const payload = { ...body };
      delete (payload as Record<string, unknown>).token;

      console.log('[create-order] Calling WordPress plugin (JWT):', url);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success && data?.order) {
        console.log('[create-order] Order created via plugin:', data.order?.id);
        return data;
      }
      if (res.status >= 400) {
        console.warn('[create-order] Plugin returned:', res.status, data);
        throw createError({
          statusCode: res.status,
          message: data?.message || data?.code || 'Failed to create order',
        });
      }
    }

    console.log('[create-order] No JWT or plugin failed, executing PHP script: createOrder.php');
    const data = await executePhpScript({
      script: 'createOrder.php',
      queryParams: {},
      method: 'POST',
      body,
    });
    return data;
  } catch (error: any) {
    console.error('[create-order] Error:', error.message || error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to create order',
    });
  }
});

