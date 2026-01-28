// server/api/php-search.get.ts
// Search products via PHP API endpoint

export default cachedEventHandler(
  async (event) => {
    try {
      const query = getQuery(event);
      
      const search = (query.search as string) || '';
      const limit = parseInt(query.limit as string || '6');
      
      if (!search) {
        return { products: { nodes: [] } };
      }
      
      // Build PHP API URL
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const phpUrl = `${baseUrl}/server/api/php/searchProducts.php`;
      
      const queryParams = new URLSearchParams({
        search: search,
        limit: String(limit)
      });
      
      const fullUrl = `${phpUrl}?${queryParams.toString()}`;
      
      console.log('[php-search] Fetching from PHP API:', fullUrl);
      
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000),
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('[php-search] PHP API error:', response.status, errorText);
        return { products: { nodes: [] } };
      }
      
      const data = await response.json();
      
      return data;
    } catch (error: any) {
      console.error('[php-search] Error:', error);
      return { products: { nodes: [] } };
    }
  },
  {
    maxAge: 5,
    swr: false,
    getKey: event => event.req.url!,
  }
);
