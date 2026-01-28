// server/api/seller-orders.get.ts
// Fetch seller orders via PHP API endpoint

import { executePhpScript } from '../utils/php-executor';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    
    const sellerId = query.seller_id;

    if (!sellerId) {
      throw createError({
        statusCode: 400,
        message: "seller_id is required",
      });
    }

    // Build query params for PHP script
    // Note: WooCommerce API doesn't support seller_id filter directly
    // We'll fetch all orders and filter in PHP script
    const queryParams: Record<string, string | number> = {
      per_page: 100,
      status: 'any', // Get all statuses
      seller_id: Number(sellerId), // Pass seller_id for filtering
    };
    
    console.log('[seller-orders] Executing PHP script: getOrders.php', queryParams);
    
    // Execute PHP script directly using PHP CLI
    const data = await executePhpScript({
      script: 'getOrders.php',
      queryParams,
      method: 'GET',
    });
    
    return data;
  } catch (error: any) {
    console.error('[seller-orders] Error:', error.message || error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to fetch seller orders",
    });
  }
});

