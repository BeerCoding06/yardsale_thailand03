// server/api/my-orders.get.ts
// Fetch user's orders via PHP API endpoint

import { executePhpScript } from '../utils/php-executor';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    
    const customerId = query.customer_id;
    const customerEmail = query.customer_email;
    
    if (!customerId && !customerEmail) {
      throw createError({
        statusCode: 400,
        message: "customer_id or customer_email is required",
      });
    }
    
    // Build query params for PHP script
    const queryParams: Record<string, string | number> = {
      per_page: 100,
    };
    if (customerId) queryParams.customer_id = Number(customerId);
    if (customerEmail) queryParams.customer_email = String(customerEmail);
    
    console.log('[my-orders] Executing PHP script: getOrders.php', queryParams);
    
    // Execute PHP script directly using PHP CLI
    const data = await executePhpScript({
      script: 'getOrders.php',
      queryParams,
      method: 'GET',
    });
    
    return data;
  } catch (error: any) {
    console.error('[my-orders] Error:', error.message || error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch orders',
    });
  }
});
