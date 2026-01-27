// server/api/wp-brands.get.ts
// Fetch product brands from WordPress REST API

import * as wpUtils from '../utils/wp.js';

export default defineEventHandler(async (event: any) => {
  try {
    const query = getQuery(event);
    
    // WordPress REST API endpoint for product brands
    // Use WordPress REST API: /wp-json/wp/v2/product_brand
    const perPage = query.per_page ? parseInt(query.per_page as string) : 100;
    const page = query.page ? parseInt(query.page as string) : 1;
    const hideEmpty = query.hide_empty !== 'false';
    const search = query.search as string | undefined;
    const orderby = (query.orderby as string) || 'name';
    const order = (query.order as string) || 'ASC';
    
    // Build query parameters
    const params: Record<string, string | number> = {
      per_page: perPage,
      page: page,
      orderby: orderby,
      order: order,
      ...(hideEmpty ? { hide_empty: '1' } : {}),
      ...(search ? { search: search } : {})
    };
    
    // Use WordPress REST API endpoint
    const apiUrl = wpUtils.buildWpApiUrl('wp/v2/product_brand', params);
    
    // Use utility function for headers
    const headers = wpUtils.getWpApiHeaders(true, false);
    
    console.log('[wp-brands] Fetching from WordPress API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[wp-brands] WordPress API error:', response.status, errorText);
      throw createError({
        statusCode: response.status,
        message: `WordPress API error: ${errorText || response.statusText}`,
      });
    }
    
    const data = await response.json();
    
    // Get pagination info from headers
    const total = response.headers.get('X-WP-Total') ? parseInt(response.headers.get('X-WP-Total')!) : 0;
    const totalPages = response.headers.get('X-WP-TotalPages') ? parseInt(response.headers.get('X-WP-TotalPages')!) : 0;
    
    return Array.isArray(data) ? data : [];
  } catch (error: any) {
    console.error('[wp-brands] Error:', error);
    // Return empty array instead of throwing error to keep the app working
    return [];
  }
});
