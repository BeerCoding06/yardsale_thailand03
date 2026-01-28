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
      
      // Build query params for PHP script
      const queryParams: Record<string, string | number> = {
        page,
        per_page: perPage,
        order,
        orderby,
      };
      if (search) queryParams.search = search;
      if (category) queryParams.category = category;
      if (after) queryParams.after = after;
      
      console.log('[products] Executing PHP script: getProducts.php', queryParams);
      
      // Execute PHP script directly using PHP CLI
      const { executePhpScript } = await import('~/server/utils/php-executor');
      const data = await executePhpScript({
        script: 'getProducts.php',
        queryParams,
        method: 'GET',
      });
      
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
