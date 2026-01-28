// server/api/get-order.get.ts
// Fetch single order via PHP API endpoint

import { executePhpScript } from '../utils/php-executor';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    
    const orderId = query.order_id;
    const customerId = query.customer_id;
    
    if (!orderId) {
      throw createError({
        statusCode: 400,
        message: "order_id is required",
      });
    }
    
    // Build query params for PHP script
    const queryParams: Record<string, string | number> = {
      order_id: Number(orderId),
    };
    if (customerId) queryParams.customer_id = Number(customerId);
    
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
