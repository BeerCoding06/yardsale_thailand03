// server/api/get-order.get.ts
// Fetch order(s) via PHP API endpoint
// Supports both single order (order_id) and customer orders (customer)

import { executePhpScript } from '../utils/php-executor';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    
    const orderId = query.order_id;
    const customerId = query.customer;
    
    if (!orderId && !customerId) {
      throw createError({
        statusCode: 400,
        message: "order_id or customer parameter is required",
      });
    }
    
    // Build query params for PHP script
    const queryParams: Record<string, string | number> = {};
    if (orderId) {
      queryParams.order_id = Number(orderId);
    }
    if (customerId) {
      queryParams.customer = Number(customerId);
    }
    
    console.log('[get-order] Executing PHP script: getOrder.php', queryParams);
    
    // Execute PHP script directly using PHP CLI
    const data = await executePhpScript({
      script: 'getOrder.php',
      queryParams,
      method: 'GET',
    });
    
    return data;
  } catch (error: any) {
    console.error('[get-order] Error:', error.message || error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch order',
    });
  }
});
