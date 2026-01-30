// server/api/update-product.post.ts
// Update product via PHP API endpoint

import { executePhpScript } from '../utils/php-executor';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    const productId = body.product_id;
    const userId = body.user_id;

    if (!productId) {
      throw createError({
        statusCode: 400,
        message: "product_id is required",
      });
    }

    console.log('[update-product] Executing PHP script: updateProduct.php');
    
    // Execute PHP script directly using PHP CLI
    const data = await executePhpScript({
      script: 'updateProduct.php',
      body: body,
      method: 'POST',
    });
    
    console.log("[update-product] Successfully updated product:", {
      productId: data?.product?.id,
      status: data?.product?.status,
    });

    return data;
  } catch (error: any) {
    console.error("[update-product] Error:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to update product",
    });
  }
});
