// server/api/wp-products.get.ts
// Fetch products from WordPress REST API

import * as wpUtils from '../utils/wp';

export default defineEventHandler(async (event: any) => {
  try {
    const query = getQuery(event);
    
    // WordPress REST API endpoint for products
    // Use WordPress REST API: /wp-json/wp/v2/product
    const perPage = query.per_page ? parseInt(query.per_page as string) : 10;
    const page = query.page ? parseInt(query.page as string) : 1;
    const search = query.search as string | undefined;
    
    // Use WordPress REST API endpoint
    let apiUrl = wpUtils.buildWpApiUrl('wp/v2/product', {
      per_page: perPage,
      page: page,
      ...(search ? { search: search } : {})
    });
    
    // Add consumer key and secret if available (for authentication)
    const consumerKey = query.consumer_key as string | undefined;
    const consumerSecret = query.consumer_secret as string | undefined;
    
    // Use utility function for headers
    // If consumer key/secret provided via query, use WooCommerce auth
    // Otherwise use Basic Auth from .env
    let headers: Record<string, string>;
    
    if (consumerKey && consumerSecret) {
      // Override with query params if provided
      // Buffer is available in Node.js server environment
      const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      };
    } else {
      // Use WooCommerce auth from .env if available, otherwise Basic Auth
      headers = wpUtils.getWpApiHeaders(false, true); // Try WooCommerce auth first
      if (!headers['Authorization']) {
        headers = wpUtils.getWpApiHeaders(true, false); // Fallback to Basic Auth
      }
    }
    
    console.log('[wp-products] Fetching from WordPress API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[wp-products] WordPress API error:', response.status, errorText);
      throw createError({
        statusCode: response.status,
        message: `WordPress API error: ${errorText || response.statusText}`,
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
      message: error.message || 'Failed to fetch products from WordPress',
    });
  }
});
