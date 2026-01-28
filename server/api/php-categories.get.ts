// server/api/php-categories.get.ts
// Fetch categories via PHP API endpoint

import { executePhpScript } from '../utils/php-executor';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    
    // Build query params for PHP script
    const queryParams: Record<string, string | number | boolean> = {};
    if (query.parent !== undefined) queryParams.parent = Number(query.parent);
    if (query.hide_empty !== undefined) queryParams.hide_empty = query.hide_empty !== 'false';
    if (query.orderby) queryParams.orderby = String(query.orderby);
    if (query.order) queryParams.order = String(query.order);
    
    console.log('[php-categories] Executing PHP script: getCategories.php', queryParams);
    
    // Execute PHP script directly using PHP CLI
    const data = await executePhpScript({
      script: 'getCategories.php',
      queryParams,
      method: 'GET',
    });
    
    return data;
  } catch (error: any) {
    console.error('[php-categories] Error:', error.message || error);
    return {
      productCategories: {
        nodes: []
      }
    };
  }
});
