// server/api/php-products.get.ts
// Fetch products via PHP API endpoint

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    
    // Build PHP API URL (use internal URL or relative path)
    // Option 1: Use internal URL if PHP is served via web server
    const baseUrl = process.env.INTERNAL_BASE_URL || process.env.BASE_URL || 'http://localhost';
    const phpUrl = `${baseUrl}/server/api/php/getProducts.php`;
    
    // Option 2: Use file system (if PHP CLI is available)
    // This would require spawning PHP process, which is more complex
    
    // Build query string
    const queryParams = new URLSearchParams();
    if (query.page) queryParams.append('page', String(query.page));
    if (query.per_page) queryParams.append('per_page', String(query.per_page));
    if (query.search) queryParams.append('search', String(query.search));
    if (query.category) queryParams.append('category', String(query.category));
    if (query.order) queryParams.append('order', String(query.order));
    if (query.orderby) queryParams.append('orderby', String(query.orderby));
    if (query.after) queryParams.append('after', String(query.after));
    
    const fullUrl = queryParams.toString() ? `${phpUrl}?${queryParams.toString()}` : phpUrl;
    
    console.log('[php-products] Fetching from PHP API:', fullUrl);
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[php-products] PHP API error:', response.status, errorText);
      return {
        products: {
          nodes: [],
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
        },
      };
    }
    
    const data = await response.json();
    
    return data;
  } catch (error: any) {
    console.error('[php-products] Error:', error);
    return {
      products: {
        nodes: [],
        pageInfo: {
          hasNextPage: false,
          endCursor: null,
        },
      },
    };
  }
});
