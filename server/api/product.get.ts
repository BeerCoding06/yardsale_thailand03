// server/api/product.get.ts
// Fetch single product via PHP API endpoint

import { executePhpScript } from '../utils/php-executor';

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
      
      // Build query params for PHP script
      const queryParams: Record<string, string | number> = {};
      if (slug) queryParams.slug = slug;
      if (sku) queryParams.sku = sku;
      if (id) queryParams.id = Number(id);
      
      console.log('[product] Executing PHP script: getProduct.php', queryParams);
      
      // Execute PHP script directly using PHP CLI
      const data = await executePhpScript({
        script: 'getProduct.php',
        queryParams,
        method: 'GET',
      });
      
      return data;
    } catch (error: any) {
      console.error('[product] Error executing PHP script:', error.message || error);
      // Log full error for debugging
      if (error.stack) {
        console.error('[product] Error stack:', error.stack);
      }
      return { product: null };
    }
  },
  {
    maxAge: 1,
    swr: false,
    getKey: event => event.req.url!,
  }
);
