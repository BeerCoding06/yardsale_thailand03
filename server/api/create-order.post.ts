// server/api/create-order.post.ts
// Create order via PHP API endpoint

import { executePhpScript } from '../utils/php-executor';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    
    console.log("[create-order] Executing PHP script: createOrder.php");

    // Execute PHP script directly using PHP CLI
    const data = await executePhpScript({
      script: 'createOrder.php',
      queryParams: {},
      method: 'POST',
      body,
    });

    return data;
  } catch (error: any) {
    console.error("[create-order] Error:", error.message || error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to create order",
    });
  }
});

