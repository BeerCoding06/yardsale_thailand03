// server/api/cancel-order.post.ts
// Cancel order via PHP API endpoint

import { executePhpScript } from '../utils/php-executor';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    
    const orderId = body.order_id;
    const customerId = body.customer_id;

    if (!orderId) {
      throw createError({
        statusCode: 400,
        message: "order_id is required",
      });
    }

    console.log('[cancel-order] Executing PHP script: cancelOrder.php');
    
    // Execute PHP script directly using PHP CLI
    const data = await executePhpScript({
      script: 'cancelOrder.php',
      body: body,
      method: 'POST',
    });
    
    console.log("[cancel-order] Successfully cancelled order:", {
      orderId: data?.order?.id,
      status: data?.order?.status,
    });

    return data;
  } catch (error: any) {
    console.error("[cancel-order] Error:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to cancel order",
    });
  }
});

