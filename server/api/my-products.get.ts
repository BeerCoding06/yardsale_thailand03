// server/api/my-products.get.ts
// Fetch user's products from WordPress REST API

import { getWpBaseUrl, getWpApiHeaders, buildWpApiUrl } from '../utils/wp';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const wpUtils = await import('../utils/wp');
    
    const userId = query.user_id;
    
    if (!userId) {
      throw createError({
        statusCode: 400,
        message: "user_id is required",
      });
    }
    
    // Use WordPress REST API to fetch products by author
    const apiUrl = wpUtils.buildWpApiUrl('wp/v2/product', {
      author: userId,
      per_page: 100,
      status: 'any', // Include all statuses (publish, draft, etc.)
      _embed: '1'
    });
    
    const headers = wpUtils.getWpApiHeaders(true, false);
    
    console.log('[my-products] Fetching from WordPress API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[my-products] WordPress API error:', response.status, errorText);
      throw createError({
        statusCode: response.status,
        message: errorText || 'Failed to fetch products',
      });
    }
    
    const data = await response.json();
    
    // Format products
    const products = Array.isArray(data) ? data : [];
    
    return {
      products,
      count: products.length
    };
  } catch (error: any) {
    console.error('[my-products] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch user products',
    });
  }
});
