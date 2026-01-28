// server/api/search.get.ts
// Search products via PHP API endpoint

import { executePhpScript } from '~/server/utils/php-executor';

export default cachedEventHandler(
  async (event) => {
    try {
      const query = getQuery(event);
      
      const search = (query.search as string) || '';
      const limit = parseInt(query.limit as string || '6');
      
      if (!search) {
        return { products: { nodes: [] } };
      }
      
      // Build query params for PHP script
      const queryParams: Record<string, string | number> = {
        search,
        limit,
      };
      
      console.log('[search] Executing PHP script: searchProducts.php', queryParams);
      
      // Execute PHP script directly using PHP CLI
      const data = await executePhpScript({
        script: 'searchProducts.php',
        queryParams,
        method: 'GET',
      });
      
      return data;
    } catch (error: any) {
      console.error('[search] Error:', error.message || error);
      return { products: { nodes: [] } };
    }
  },
  {
    maxAge: 5,
    swr: false,
    getKey: event => event.req.url!,
  }
);
