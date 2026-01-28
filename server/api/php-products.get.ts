// server/api/php-products.get.ts
// Fetch products via PHP API endpoint

import { executePhpScript } from '../utils/php-executor';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    
    // Build query params for PHP script
    const queryParams: Record<string, string | number> = {};
    if (query.page) queryParams.page = Number(query.page);
    if (query.per_page) queryParams.per_page = Number(query.per_page);
    if (query.search) queryParams.search = String(query.search);
    if (query.category) queryParams.category = String(query.category);
    if (query.order) queryParams.order = String(query.order);
    if (query.orderby) queryParams.orderby = String(query.orderby);
    if (query.after) queryParams.after = String(query.after);
    
    console.log('[php-products] Executing PHP script: getProducts.php', queryParams);
    
    // Execute PHP script directly using PHP CLI
    const data = await executePhpScript({
      script: 'getProducts.php',
      queryParams,
      method: 'GET',
    });
    
    return data;
  } catch (error: any) {
    console.error('[php-products] Error:', error.message || error);
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
