// server/api/get-order.get.ts
// Fetch single order from WooCommerce REST API

import * as wpUtils from '../utils/wp';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    
    const orderId = query.order_id;
    const customerId = query.customer_id;
    
    if (!orderId) {
      throw createError({
        statusCode: 400,
        message: "order_id is required",
      });
    }
    
    // Check WooCommerce credentials
    const consumerKey = wpUtils.getWpConsumerKey();
    const consumerSecret = wpUtils.getWpConsumerSecret();
    
    if (!consumerKey || !consumerSecret) {
      throw createError({
        statusCode: 500,
        message: "WooCommerce API credentials not configured",
      });
    }
    
    const apiUrl = wpUtils.buildWcApiUrl(`wc/v3/orders/${orderId}`);
    
    console.log('[get-order] Fetching from WooCommerce API:', apiUrl.replace(/consumer_secret=[^&]+/, 'consumer_secret=***'));
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[get-order] WooCommerce API error:', response.status, errorText);
      throw createError({
        statusCode: response.status,
        message: errorText || 'Failed to fetch order',
      });
    }
    
    const order = await response.json();
    
    // Verify customer if customer_id is provided
    if (customerId && order.customer_id && parseInt(order.customer_id) !== parseInt(customerId as string)) {
      throw createError({
        statusCode: 403,
        message: "Access denied",
      });
    }
    
    return {
      order
    };
  } catch (error: any) {
    console.error('[get-order] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch order',
    });
  }
});
