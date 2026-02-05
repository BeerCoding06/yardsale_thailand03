// server/api/wp-brands.get.ts
// Fetch product brands from WordPress REST API (custom taxonomy)
// Note: Brands is a custom taxonomy, not part of WooCommerce core API
// We'll try WooCommerce API first, then fallback to WordPress REST API

import * as wpUtils from '../utils/wp';

export default defineEventHandler(async (event: any) => {
  try {
    const query = getQuery(event);
    
    // Try WordPress REST API for custom taxonomy first (brands is custom taxonomy)
    // WordPress REST API: /wp-json/wp/v2/product_brand
    const perPage = query.per_page ? parseInt(query.per_page as string) : 100;
    const page = query.page ? parseInt(query.page as string) : 1;
    const search = query.search as string | undefined;
    const orderby = (query.orderby as string) || 'name';
    const order = (query.order as string) || 'asc';
    
    // Build query parameters for WordPress REST API
    // WordPress REST API for custom taxonomy supports: per_page, page, orderby, order, search, hide_empty
    const params: Record<string, string | number | boolean> = {
      per_page: perPage,
      page: page,
      orderby: orderby === 'name' ? 'name' : 'id',
      order: order.toLowerCase() === 'desc' ? 'desc' : 'asc',
      hide_empty: false, // Show all brands even if they have no products
      ...(search ? { search: search } : {})
    };
    
    // Use WordPress REST API endpoint for custom taxonomy
    const apiUrl = wpUtils.buildWpApiUrl('wp/v2/product_brand', params);
    
    // Use utility function for headers with Basic Auth
    const headers = wpUtils.getWpApiHeaders(true, false);
    
    console.log('[wp-brands] Fetching from WordPress REST API:', apiUrl);
    console.log('[wp-brands] Params:', JSON.stringify(params, null, 2));
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[wp-brands] WordPress REST API error:', response.status, errorText);
      console.error('[wp-brands] Request URL:', apiUrl);
      
      // If 404 or custom taxonomy doesn't exist, return empty array
      if (response.status === 404) {
        console.warn('[wp-brands] Custom taxonomy "product_brand" not found. Returning empty array.');
        return [];
      }
      
      // Return empty array instead of throwing error to keep the app working
      console.warn('[wp-brands] Returning empty array due to API error');
      return [];
    }
    
    const data = await response.json();
    
    // Format brands for compatibility with FormCreateProducts
    // WordPress REST API returns array of brand objects with: id, name, slug, description, count
    const brands = Array.isArray(data) ? data.map((brand: any) => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      description: brand.description || '',
      count: brand.count || 0,
    })) : [];
    
    console.log('[wp-brands] Successfully fetched', brands.length, 'brands');
    
    return brands;
  } catch (error: any) {
    console.error('[wp-brands] Error:', error);
    // Return empty array instead of throwing error to keep the app working
    return [];
  }
});
