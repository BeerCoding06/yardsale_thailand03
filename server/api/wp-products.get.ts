// server/api/wp-products.get.ts
// Fetch products from WooCommerce REST API

import * as wpUtils from '../utils/wp';

export default defineEventHandler(async (event: any) => {
  try {
    const query = getQuery(event);
    
    // WooCommerce REST API endpoint for products
    // Use WooCommerce REST API: /wp-json/wc/v3/products
    const perPage = query.per_page ? parseInt(query.per_page as string) : 10;
    const page = query.page ? parseInt(query.page as string) : 1;
    const search = query.search as string | undefined;
    
    // Get consumer key and secret from query params or .env
    const consumerKey = (query.consumer_key as string | undefined) || wpUtils.getWpConsumerKey();
    const consumerSecret = (query.consumer_secret as string | undefined) || wpUtils.getWpConsumerSecret();
    
    // Build WooCommerce API URL with consumer_key and consumer_secret in query params
    const wcParams: Record<string, string | number> = {
      per_page: perPage,
      page: page,
      ...(search ? { search: search } : {})
    };
    
    // Use buildWcApiUrl which automatically adds consumer_key and consumer_secret
    // Or use query params if provided
    if (consumerKey && consumerSecret) {
      wcParams['consumer_key'] = consumerKey;
      wcParams['consumer_secret'] = consumerSecret;
    }
    
    const apiUrl = wpUtils.buildWcApiUrl('wc/v3/products', wcParams);
    
    console.log('[wp-products] Fetching from WooCommerce API:', apiUrl.replace(/consumer_secret=[^&]+/, 'consumer_secret=***'));
    
    // No headers needed - authentication is via query params
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[wp-products] WooCommerce API error:', response.status, errorText);
      throw createError({
        statusCode: response.status,
        message: `WooCommerce API error: ${errorText || response.statusText}`,
      });
    }
    
    const data = await response.json();
    
    // Get pagination info from headers
    const total = response.headers.get('X-WP-Total') ? parseInt(response.headers.get('X-WP-Total')!) : 0;
    const totalPages = response.headers.get('X-WP-TotalPages') ? parseInt(response.headers.get('X-WP-TotalPages')!) : 0;
    
    return {
      products: Array.isArray(data) ? data : [],
      total,
      totalPages,
      page,
      perPage,
    };
  } catch (error: any) {
    console.error('[wp-products] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch products from WooCommerce',
    });
  }
});
