// server/api/my-products.get.ts
// Fetch user's products via PHP API endpoint

import { executePhpScript } from '../utils/php-executor';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    
    const userId = query.user_id as string | undefined;
    
    if (!userId) {
      throw createError({
        statusCode: 400,
        message: "user_id is required",
      });
    }
    
    // Build query params for PHP script
    const queryParams: Record<string, string | number> = {
      user_id: Number(userId),
    };
    
    console.log('[my-products] Executing PHP script: getMyProducts.php', queryParams);
    
    // Execute PHP script directly using PHP CLI
    const data = await executePhpScript({
      script: 'getMyProducts.php',
      queryParams,
      method: 'GET',
    });
    
    return data;
  } catch (error: any) {
    console.error('[my-products] Error:', error.message || error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch user products',
    });
  }
});
