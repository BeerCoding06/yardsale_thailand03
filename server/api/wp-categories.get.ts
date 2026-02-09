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
    
    // Use Basic Auth for WooCommerce API (same as PHP script)
    // PHP script uses Basic Auth, so we'll use it too for consistency
    const basicAuth = wpUtils.getWpBasicAuth();
    
    if (!basicAuth) {
      console.error('[wp-categories] WordPress Basic Auth not configured');
      throw createError({
        statusCode: 500,
        message: 'WordPress Basic Auth not configured. Please set WP_BASIC_AUTH in environment variables.',
      });
    }
    
    // Build WooCommerce API URL (without consumer_key/consumer_secret in query params)
    const baseUrl = wpUtils.getWpBaseUrl();
    const queryString = new URLSearchParams(params as Record<string, string>).toString();
    const apiUrl = `${baseUrl}/wp-json/wc/v3/products/categories${queryString ? `?${queryString}` : ''}`;
    
    // Use Basic Auth header (same as PHP script)
    let authString = basicAuth;
    // If it contains ':' it's username:password format, encode it
    if (authString.includes(':')) {
      authString = Buffer.from(authString).toString('base64');
    }
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Basic ${authString}`,
    };
    
    console.log('[wp-categories] Fetching from WooCommerce API:', apiUrl);
    console.log('[wp-categories] Params:', JSON.stringify(params, null, 2));
    console.log('[wp-categories] Using Basic Auth:', basicAuth ? 'Yes' : 'No');
    
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
    const allCategories = Array.isArray(data) ? data.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      count: cat.count || 0,
      parent: cat.parent || 0,
      image: cat.image ? { src: cat.image.src || cat.image } : null,
    })) : [];
    
    // Filter out "Uncategorized" or "No Category" categories
    const categories = allCategories.filter((cat: any) => {
      const name = (cat.name || '').trim().toLowerCase();
      const slug = (cat.slug || '').trim().toLowerCase();
      
      // Exclude categories with these names/slugs
      const excludedNames = [
        'uncategorized',
        'uncategorised',
        'no category',
        'no-category',
        'no_category',
        'unclassified',
        'อื่นๆ',
        'อื่นๆ',
      ];
      
      return !excludedNames.includes(name) && !excludedNames.includes(slug);
    });
    
    console.log('[wp-categories] Successfully fetched', allCategories.length, 'categories, filtered to', categories.length, 'categories (excluded uncategorized)');
    
    return categories;
  } catch (error: any) {
    console.error('[wp-categories] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch categories from WooCommerce',
    });
  }
});
