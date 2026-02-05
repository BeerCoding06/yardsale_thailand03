// server/api/wp-categories.get.ts
// Fetch product categories from WordPress REST API

import * as wpUtils from '../utils/wp';

export default defineEventHandler(async (event: any) => {
  try {
    const query = getQuery(event);
    
    // WordPress REST API endpoint for product categories
    // Use WordPress REST API: /wp-json/wp/v2/product_cat
    const perPage = query.per_page ? parseInt(query.per_page as string) : 100;
    const page = query.page ? parseInt(query.page as string) : 1;
    const parent = query.parent !== undefined ? parseInt(query.parent as string) : undefined;
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
      ...(parent !== undefined ? { parent: parent } : {}),
      ...(search ? { search: search } : {})
    };
    
    // Use WordPress REST API endpoint
    const apiUrl = wpUtils.buildWpApiUrl('wp/v2/product_cat', params);
    
    // Use utility function for headers
    const headers = wpUtils.getWpApiHeaders(true, false);
    
    console.log('[wp-categories] Fetching from WordPress API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[wp-categories] WordPress API error:', response.status, errorText);
      throw createError({
        statusCode: response.status,
        message: `WordPress API error: ${errorText || response.statusText}`,
      });
    }
    
    const data = await response.json();
    
    // Get pagination info from headers
    const total = response.headers.get('X-WP-Total') ? parseInt(response.headers.get('X-WP-Total')!) : 0;
    const totalPages = response.headers.get('X-WP-TotalPages') ? parseInt(response.headers.get('X-WP-TotalPages')!) : 0;
    
    // Return array directly for compatibility with FormCreateProducts
    const categories = Array.isArray(data) ? data : [];
    
    // Return both formats for compatibility
    return categories;
  } catch (error: any) {
    console.error('[wp-categories] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch categories from WordPress',
    });
  }
});
