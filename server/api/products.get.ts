// server/api/products.get.ts
// Use PHP API instead of GraphQL

export default cachedEventHandler(
  async (event) => {
    try {
      const config = useRuntimeConfig();
      const baseUrl = config.baseUrl || 'http://localhost/yardsale_thailand';
      
      // Get query parameters
      const query = getQuery(event);
      const after = query.after as string | undefined;
      const search = query.search as string | undefined;
      const category = query.category as string | undefined;
      const order = (query.order as string) || 'DESC';
      const field = (query.field as string) || 'DATE';
      
      // Parse page from cursor (simple implementation)
      let page = 1;
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
      
      // Build PHP API URL
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('per_page', '21');
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      params.set('order', order);
      params.set('orderby', field);
      
      const phpApiUrl = `${baseUrl}/server/api/php/getProducts.php?${params.toString()}`;
      
      // Call PHP API
      const response = await $fetch(phpApiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      return response;
    } catch (error: any) {
      console.error('[products] Error:', error);
      throw createError({
        statusCode: error?.statusCode || 500,
        message: error?.message || 'Failed to fetch products from PHP API',
      });
    }
  },
  {
    maxAge: 1, // Cache for 1 second (real-time)
    swr: false, // Disable SWR for immediate updates
    getKey: event => event.req.url!,
  }
);
