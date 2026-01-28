// server/api/php-product.get.ts
// Fetch single product via PHP API endpoint

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    
    // Build PHP API URL
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const phpUrl = `${baseUrl}/server/api/php/getProduct.php`;
    
    // Build query string
    const queryParams = new URLSearchParams();
    if (query.slug) queryParams.append('slug', String(query.slug));
    if (query.sku) queryParams.append('sku', String(query.sku));
    if (query.id) queryParams.append('id', String(query.id));
    
    if (queryParams.toString() === '') {
      return { product: null };
    }
    
    const fullUrl = `${phpUrl}?${queryParams.toString()}`;
    
    console.log('[php-product] Fetching from PHP API:', fullUrl);
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[php-product] PHP API error:', response.status, errorText);
      return { product: null };
    }
    
    const data = await response.json();
    
    return data;
  } catch (error: any) {
    console.error('[php-product] Error:', error);
    return { product: null };
  }
});
