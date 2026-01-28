// server/api/products.get.ts
// Fetch products via PHP API endpoint

export default cachedEventHandler(
  async (event) => {
    try {
      const query = getQuery(event);
      
      // Parse pagination from cursor
      let page = 1;
      const after = query.after as string | undefined;
      if (after) {
        try {
          const decoded = Buffer.from(after, 'base64').toString('utf-8');
          const match = decoded.match(/page:(\d+)/);
          if (match) {
            page = parseInt(match[1]);
          }
        } catch (e) {
          // Invalid cursor, use page 1
        }
      }
      
      const perPage = 21;
      const search = query.search as string | undefined;
      const category = query.category as string | undefined;
      const order = (query.order as string)?.toLowerCase() || 'desc';
      const orderby = (query.orderby as string)?.toLowerCase() || 'date';
      
      // Build PHP API URL
      const baseUrl = process.env.INTERNAL_BASE_URL || process.env.BASE_URL || 'http://localhost';
      const phpUrl = `${baseUrl}/server/api/php/getProducts.php`;
      
      // Build query string
      const queryParams = new URLSearchParams();
      queryParams.append('page', String(page));
      queryParams.append('per_page', String(perPage));
      queryParams.append('order', order);
      queryParams.append('orderby', orderby);
      if (search) queryParams.append('search', search);
      if (category) queryParams.append('category', category);
      if (after) queryParams.append('after', after);
      
      const fullUrl = `${phpUrl}?${queryParams.toString()}`;
      
      console.log('[products] Fetching from PHP API:', fullUrl);
      
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000),
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('[products] PHP API error:', response.status, errorText);
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
      console.error('[products] Error:', error);
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
  },
  {
    maxAge: 30,
    swr: false,
    getKey: event => event.req.url!,
  }
);
