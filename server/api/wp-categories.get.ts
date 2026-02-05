// server/api/wp-categories.get.ts
// Fetch product categories from WooCommerce REST API
// Use WooCommerce API instead of WordPress REST API for better compatibility

import * as wpUtils from '../utils/wp';

export default defineEventHandler(async (event: any) => {
  try {
    const query = getQuery(event);
    
    // Use WooCommerce REST API endpoint for product categories
    // WooCommerce API: /wp-json/wc/v3/products/categories
    const perPage = query.per_page ? parseInt(query.per_page as string) : 100;
    const page = query.page ? parseInt(query.page as string) : 1;
    const parent = query.parent !== undefined ? parseInt(query.parent as string) : undefined;
    const search = query.search as string | undefined;
    const orderby = (query.orderby as string) || 'name';
    const order = (query.order as string) || 'asc';
    
    // Build query parameters for WooCommerce API
    // WooCommerce API supports: per_page, page, orderby (id, name, slug, count), order (asc/desc), parent, search
    const params: Record<string, string | number> = {
      per_page: perPage,
      page: page,
      orderby: orderby === 'name' ? 'name' : 'id',
      order: order.toLowerCase() === 'desc' ? 'desc' : 'asc',
      ...(parent !== undefined ? { parent: parent } : {}),
      ...(search ? { search: search } : {})
    };
    
    // Use WooCommerce API endpoint with consumer key/secret in query params
    const apiUrl = wpUtils.buildWcApiUrl('wc/v3/products/categories', params);
    
    // WooCommerce API uses consumer_key/consumer_secret in query params, not Basic Auth
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    console.log('[wp-categories] Fetching from WooCommerce API:', apiUrl);
    console.log('[wp-categories] Params:', JSON.stringify(params, null, 2));
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[wp-categories] WooCommerce API error:', response.status, errorText);
      console.error('[wp-categories] Request URL:', apiUrl);
      
      // Try to parse error message
      let errorMessage = `WooCommerce API error (${response.status}): ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
          errorMessage = errorJson.message;
        } else if (errorJson.code) {
          errorMessage = `${errorJson.code}: ${errorJson.message || errorJson.data?.message || errorText}`;
        }
      } catch (e) {
        // Not JSON, use text as is
        if (errorText) {
          errorMessage = errorText.substring(0, 500);
        }
      }
      
      throw createError({
        statusCode: response.status,
        message: errorMessage,
      });
    }
    
    const data = await response.json();
    
    // Format categories for compatibility with FormCreateProducts
    // WooCommerce API returns array of category objects with: id, name, slug, description, count, image, parent
    const categories = Array.isArray(data) ? data.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      count: cat.count || 0,
      parent: cat.parent || 0,
      image: cat.image ? { src: cat.image.src || cat.image } : null,
    })) : [];
    
    console.log('[wp-categories] Successfully fetched', categories.length, 'categories');
    
    return categories;
  } catch (error: any) {
    console.error('[wp-categories] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch categories from WooCommerce',
    });
  }
});
