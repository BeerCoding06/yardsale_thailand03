// server/api/wp-tags.get.ts
// Fetch product tags from WooCommerce REST API (สำหรับ select ใน create product)
// รองรับ consumer_key/consumer_secret และ Basic Auth

import * as wpUtils from '../utils/wp';

export default defineEventHandler(async (event: any) => {
  try {
    const query = getQuery(event);
    
    const perPage = query.per_page ? parseInt(query.per_page as string) : 100;
    const page = query.page ? parseInt(query.page as string) : 1;
    const search = query.search as string | undefined;
    const orderby = (query.orderby as string) || 'name';
    const order = (query.order as string) || 'asc';
    
    const params: Record<string, string | number> = {
      per_page: perPage,
      page: page,
      orderby: orderby === 'name' ? 'name' : 'id',
      order: order.toLowerCase() === 'desc' ? 'desc' : 'asc',
      ...(search ? { search: search } : {})
    };
    
    const apiUrl = wpUtils.buildWcApiUrl('wc/v3/products/tags', params);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    const basicAuth = wpUtils.getWpBasicAuth();
    if (basicAuth) {
      const authString = basicAuth.includes(':') ? Buffer.from(basicAuth).toString('base64') : basicAuth;
      headers['Authorization'] = `Basic ${authString}`;
    }
    
    console.log('[wp-tags] Fetching from WooCommerce API');
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      console.warn('[wp-tags] API error:', response.status, 'returning empty array');
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
