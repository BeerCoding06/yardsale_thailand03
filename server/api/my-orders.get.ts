// server/api/my-orders.get.ts
// Fetch user's orders from WooCommerce REST API

import { getWpBaseUrl, getWpApiHeaders, buildWpApiUrl } from '../utils/wp';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const wpUtils = await import('../utils/wp');
    
    const customerId = query.customer_id;
    const customerEmail = query.customer_email;
    
    if (!customerId && !customerEmail) {
      throw createError({
        statusCode: 400,
        message: "customer_id or customer_email is required",
      });
    }
    
    // Use WooCommerce REST API to fetch orders
    const wcHeaders = wpUtils.getWpApiHeaders(false, true);
    
    if (!wcHeaders['Authorization']) {
      throw createError({
        statusCode: 500,
        message: "WooCommerce API credentials not configured",
      });
    }
    
    const params: Record<string, string | number> = {
      per_page: 100,
      ...(customerId ? { customer: customerId } : {}),
      ...(customerEmail ? { customer_email: customerEmail } : {})
    };
    
    const apiUrl = wpUtils.buildWpApiUrl('wc/v3/orders', params);
    
    console.log('[my-orders] Fetching from WooCommerce API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: wcHeaders,
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[my-orders] WooCommerce API error:', response.status, errorText);
      throw createError({
        statusCode: response.status,
        message: errorText || 'Failed to fetch orders',
      });
    }
    
    const data = await response.json();
    
    const orders = Array.isArray(data) ? data : [];
    
    return {
      orders,
      count: orders.length
    };
  } catch (error: any) {
    console.error('[my-orders] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch orders',
    });
  }
});
