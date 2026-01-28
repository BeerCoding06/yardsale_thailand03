// server/api/cart/add.post.ts
// Add product to cart via PHP API endpoint

import { executePhpScript } from '../../utils/php-executor';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    
    const { productId } = body;
    
    if (!productId) {
      throw createError({
        statusCode: 400,
        message: 'productId is required',
      });
    }
    
    console.log('[cart/add] Executing PHP script: addToCart.php', { productId });
    
    // Execute PHP script directly using PHP CLI
    const data = await executePhpScript({
      script: 'addToCart.php',
      queryParams: {},
      method: 'POST',
      body: { productId },
    });
    
    return data;
  } catch (error: any) {
    console.error('[cart/add] Error:', error.message || error);
    
    if (error.statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to add to cart',
    });
  }
});
