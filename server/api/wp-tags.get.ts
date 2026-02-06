// server/api/wp-tags.get.ts
// Fetch product tags from WooCommerce REST API

import * as wpUtils from '../utils/wp';

export default defineEventHandler(async (event: any) => {
  try {
    const query = getQuery(event);
    
    // Use WooCommerce REST API endpoint for product tags
    // WooCommerce API: /wp-json/wc/v3/products/tags
    const perPage = query.per_page ? parseInt(query.per_page as string) : 100;
    const page = query.page ? parseInt(query.page as string) : 1;
    const search = query.search as string | undefined;
    const orderby = (query.orderby as string) || 'name';
    const order = (query.order as string) || 'asc';
    
    // Build query parameters for WooCommerce API
    // WooCommerce API supports: per_page, page, orderby (id, name, slug, count), order (asc/desc), search
    const params: Record<string, string | number> = {
      per_page: perPage,
      page: page,
      orderby: orderby === 'name' ? 'name' : 'id',
      order: order.toLowerCase() === 'desc' ? 'desc' : 'asc',
      ...(search ? { search: search } : {})
    };
    
    // Use Basic Auth for WooCommerce API (same as PHP script)
    const basicAuth = wpUtils.getWpBasicAuth();
    
    if (!basicAuth) {
      console.warn('[wp-tags] WordPress Basic Auth not configured, returning empty array');
      return [];
    }
    
    // Build WooCommerce API URL (without consumer_key/consumer_secret in query params)
    const baseUrl = wpUtils.getWpBaseUrl();
    const queryString = new URLSearchParams(params as Record<string, string>).toString();
    const apiUrl = `${baseUrl}/wp-json/wc/v3/products/tags${queryString ? `?${queryString}` : ''}`;
    
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
    
    console.log('[wp-tags] Fetching from WooCommerce API:', apiUrl);
    console.log('[wp-tags] Params:', JSON.stringify(params, null, 2));
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[wp-tags] WooCommerce API error:', response.status, errorText);
      console.error('[wp-tags] Request URL:', apiUrl);
      
      // Return empty array instead of throwing error to keep the app working
      console.warn('[wp-tags] Returning empty array due to API error');
      return [];
    }
    
    const data = await response.json();
    
    // Format tags for compatibility with FormCreateProducts
    // WooCommerce API returns array of tag objects with: id, name, slug, description, count
    const tags = Array.isArray(data) ? data.map((tag: any) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      description: tag.description || '',
      count: tag.count || 0,
    })) : [];
    
    console.log('[wp-tags] Successfully fetched', tags.length, 'tags');
    
    return tags;
  } catch (error: any) {
    console.error('[wp-tags] Error:', error);
    // Return empty array instead of throwing error to keep the app working
    return [];
  }
});
