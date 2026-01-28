// server/api/product.get.ts
// Fetch single product via PHP API endpoint

export default cachedEventHandler(
  async (event) => {
    try {
      const query = getQuery(event);
      
      const slug = query.slug as string | undefined;
      const sku = query.sku as string | undefined;
      const id = query.id as string | undefined;
      
      if (!slug && !sku && !id) {
        return { product: null };
      }
      
      // Build PHP API URL
      const baseUrl = process.env.INTERNAL_BASE_URL || process.env.BASE_URL || 'http://localhost';
      const phpUrl = `${baseUrl}/server/api/php/getProduct.php`;
      
      // Build query string
      const queryParams = new URLSearchParams();
      if (slug) queryParams.append('slug', slug);
      if (sku) queryParams.append('sku', sku);
      if (id) queryParams.append('id', String(id));
      
      const fullUrl = `${phpUrl}?${queryParams.toString()}`;
      
      console.log('[product] Fetching from PHP API:', fullUrl);
      
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000),
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('[product] PHP API error:', response.status, errorText);
        return { product: null };
      }
      
      const data = await response.json();
      
      return data;
    } catch (error: any) {
      console.error('[product] Error:', error);
      return { product: null };
    }
  },
  {
    maxAge: 1,
    swr: false,
    getKey: event => event.req.url!,
  }
);
