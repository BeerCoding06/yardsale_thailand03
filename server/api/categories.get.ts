// server/api/categories.get.ts
// Fetch categories via PHP API endpoint

import { executePhpScript } from '../utils/php-executor';

export default cachedEventHandler(
  async (event) => {
    try {
      const query = getQuery(event);
      
      // Build query params for PHP script
      const queryParams: Record<string, string | number | boolean> = {};
      if (query.parent !== undefined) queryParams.parent = Number(query.parent);
      if (query.hide_empty !== undefined) queryParams.hide_empty = query.hide_empty !== 'false';
      if (query.orderby) queryParams.orderby = String(query.orderby);
      if (query.order) queryParams.order = String(query.order);
      
      console.log('[categories] Executing PHP script: getCategories.php', queryParams);
      
      // Execute PHP script directly using PHP CLI
      const data = await executePhpScript({
        script: 'getCategories.php',
        queryParams,
        method: 'GET',
      });
      
      console.log('[categories] PHP script response:', JSON.stringify(data).substring(0, 500));
      console.log('[categories] Has productCategories?', !!data?.productCategories);
      console.log('[categories] Has nodes?', !!data?.productCategories?.nodes);
      console.log('[categories] Nodes length:', data?.productCategories?.nodes?.length || 0);
      
      // Ensure response structure is correct
      if (!data || !data.productCategories || !Array.isArray(data.productCategories.nodes)) {
        console.warn('[categories] Invalid response structure, returning empty array');
        return {
          productCategories: {
            nodes: []
          }
        };
      }
      
      return data;
    } catch (error: any) {
      console.error('[categories] Error:', error.message || error);
      return {
        productCategories: {
          nodes: []
        }
      };
    }
  },
  {
    maxAge: 60 * 5, // Cache for 5 minutes
    swr: true, // Enable stale-while-revalidate
    getKey: (event) => {
      const query = getQuery(event);
      return `categories-${query.parent || 0}-${query.hide_empty || true}-${query.orderby || 'name'}-${query.order || 'ASC'}`;
    },
  }
);
