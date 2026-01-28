// server/api/my-products.get.ts
// Fetch user's products using WooCommerce REST API: /wp-json/wc/v3/products

import * as wpUtils from '../utils/wp';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    
    const userId = query.user_id as string | undefined;
    
    if (!userId) {
      throw createError({
        statusCode: 400,
        message: "user_id is required",
      });
    }
    
    // Check WooCommerce credentials
    const consumerKey = wpUtils.getWpConsumerKey();
    const consumerSecret = wpUtils.getWpConsumerSecret();
    
    if (!consumerKey || !consumerSecret) {
      throw createError({
        statusCode: 500,
        message: 'WooCommerce API credentials not configured',
      });
    }
    
    // WooCommerce API doesn't support filtering by author directly
    // We need to fetch all products and filter by author, or use WordPress REST API for author filtering
    // For now, we'll use WooCommerce API and filter client-side if needed
    // Or we can fetch from WordPress REST API first to get product IDs, then fetch details from WooCommerce
    
    // Option 1: Use WordPress REST API to get product IDs by author, then fetch from WooCommerce
    // This ensures we get price data from WooCommerce
    let productIds: number[] = [];
    
    try {
      const wpUrl = wpUtils.buildWpApiUrl('wp/v2/product', {
        author: userId,
        per_page: 100,
        status: 'any',
        fields: 'id'
      });
      const wpHeaders = wpUtils.getWpApiHeaders(true, false);
      
      const wpResponse = await fetch(wpUrl, {
        method: 'GET',
        headers: wpHeaders,
        signal: AbortSignal.timeout(10000),
      });
      
      if (wpResponse.ok) {
        const wpData = await wpResponse.json();
        productIds = Array.isArray(wpData) ? wpData.map((p: any) => p.id) : [];
      }
    } catch (wpError) {
      console.warn('[my-products] Error fetching product IDs from WordPress API:', wpError);
    }
    
    // Fetch products from WooCommerce API using product IDs
    const products: any[] = [];
    
    if (productIds.length > 0) {
      // Fetch products in batches (WooCommerce API supports include parameter)
      const wcUrl = wpUtils.buildWcApiUrl('wc/v3/products', {
        include: productIds.join(','),
        per_page: 100,
        status: 'any'
      });
      
      console.log('[my-products] Fetching from WooCommerce API:', wcUrl.replace(/consumer_secret=[^&]+/, 'consumer_secret=***'));
      
      const wcResponse = await fetch(wcUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000),
      });
      
      if (wcResponse.ok) {
        const wcData = await wcResponse.json();
        products.push(...(Array.isArray(wcData) ? wcData : []));
      } else {
        const errorText = await wcResponse.text().catch(() => '');
        console.error('[my-products] WooCommerce API error:', wcResponse.status, errorText);
      }
    }
    
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
