// server/api/php-categories.get.ts
// Fetch categories via PHP API endpoint

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    
    // Build PHP API URL
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const phpUrl = `${baseUrl}/server/api/php/getCategories.php`;
    
    // Build query string
    const queryParams = new URLSearchParams();
    if (query.parent !== undefined) queryParams.append('parent', String(query.parent));
    if (query.hide_empty !== undefined) queryParams.append('hide_empty', String(query.hide_empty));
    if (query.orderby) queryParams.append('orderby', String(query.orderby));
    if (query.order) queryParams.append('order', String(query.order));
    
    const fullUrl = queryParams.toString() ? `${phpUrl}?${queryParams.toString()}` : phpUrl;
    
    console.log('[php-categories] Fetching from PHP API:', fullUrl);
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[php-categories] PHP API error:', response.status, errorText);
      return {
        productCategories: {
          nodes: []
        }
      };
    }
    
    const data = await response.json();
    
    return data;
  } catch (error: any) {
    console.error('[php-categories] Error:', error);
    return {
      productCategories: {
        nodes: []
      }
    };
  }
});
