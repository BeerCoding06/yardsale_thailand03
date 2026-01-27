// server/api/wp-products.get.ts
// Fetch products from WordPress REST API

export default defineEventHandler(async (event: any) => {
  try {
    const query = getQuery(event);
    const wpUtils = await import('../utils/wp');
    
    // WordPress base URL from .env (can be overridden via query parameter)
    const wpBaseUrl = (query.wp_url as string) || wpUtils.getWpBaseUrl();
    const cleanWpBase = wpBaseUrl.replace(/\/$/, '');
    
    // WordPress REST API endpoint for products
    // Using WooCommerce REST API if available, otherwise WordPress REST API
    const perPage = query.per_page ? parseInt(query.per_page as string) : 10;
    const page = query.page ? parseInt(query.page as string) : 1;
    const search = query.search as string | undefined;
    
    // Try WooCommerce REST API first
    let apiUrl = `${cleanWpBase}/wp-json/wc/v3/products?per_page=${perPage}&page=${page}`;
    
    if (search) {
      apiUrl += `&search=${encodeURIComponent(search)}`;
    }
    
    // Add consumer key and secret if available (for authentication)
    const consumerKey = query.consumer_key as string | undefined;
    const consumerSecret = query.consumer_secret as string | undefined;
    
    // Use utility function for headers, or override with query params
    let headers = wpUtils.getWpApiHeaders(true, false);
    
    // Override with query params if provided
    if (consumerKey && consumerSecret) {
      const auth = globalThis.Buffer 
        ? globalThis.Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')
        : btoa(`${consumerKey}:${consumerSecret}`);
      headers['Authorization'] = `Basic ${auth}`;
    }
    
    console.log('[wp-products] Fetching from WordPress API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      // If WooCommerce API fails, try WordPress REST API
      if (response.status === 404 || response.status === 401) {
        console.log('[wp-products] WooCommerce API not available, trying WordPress REST API');
        
        // Try WordPress REST API for posts with post_type=product
        let wpApiUrl = `${cleanWpBase}/wp-json/wp/v2/product?per_page=${perPage}&page=${page}`;
        if (search) {
          wpApiUrl += `&search=${encodeURIComponent(search)}`;
        }
        
        const wpResponse = await fetch(wpApiUrl, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(30000),
        });
        
        if (!wpResponse.ok) {
          const errorText = await wpResponse.text().catch(() => '');
          console.error('[wp-products] WordPress API error:', wpResponse.status, errorText);
          throw createError({
            statusCode: wpResponse.status,
            message: `WordPress API error: ${errorText || wpResponse.statusText}`,
          });
        }
        
        const wpData = await wpResponse.json();
        return {
          products: Array.isArray(wpData) ? wpData : [],
          total: wpResponse.headers.get('X-WP-Total') ? parseInt(wpResponse.headers.get('X-WP-Total')!) : 0,
          totalPages: wpResponse.headers.get('X-WP-TotalPages') ? parseInt(wpResponse.headers.get('X-WP-TotalPages')!) : 0,
          page,
          perPage,
        };
      }
      
      const errorText = await response.text().catch(() => '');
      console.error('[wp-products] WooCommerce API error:', response.status, errorText);
      throw createError({
        statusCode: response.status,
        message: `WooCommerce API error: ${errorText || response.statusText}`,
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
