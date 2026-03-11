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
    
    const config = useRuntimeConfig();
    const phpEnv: Record<string, string> = {};
    if (config.wpBaseUrl) phpEnv.WP_BASE_URL = config.wpBaseUrl;
    if (config.wpBasicAuth) phpEnv.WP_BASIC_AUTH = config.wpBasicAuth;
    if (config.wpConsumerKey) phpEnv.WP_CONSUMER_KEY = config.wpConsumerKey;
    if (config.wpConsumerSecret) phpEnv.WP_CONSUMER_SECRET = config.wpConsumerSecret;
    
    const data = await executePhpScript({
      script: 'addToCart.php',
      queryParams: {},
      method: 'POST',
      body: { productId },
      env: phpEnv,
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
