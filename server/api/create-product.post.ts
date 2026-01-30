// server/api/create-product.post.ts
// Create product via PHP API endpoint

import { executePhpScript } from '../utils/php-executor';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    console.log("[create-product] Received payload:", {
      name: body.name,
      type: body.type,
      regular_price: body.regular_price,
      categories: body.categories,
      imagesCount: body.images?.length || 0,
      post_author: body.post_author,
    });

    console.log('[create-product] Executing PHP script: createProduct.php');
    
    // Execute PHP script directly using PHP CLI
    const data = await executePhpScript({
      script: 'createProduct.php',
      body: body,
      method: 'POST',
    });
    
    console.log("[create-product] Successfully created product:", {
      id: data?.product?.id,
      name: data?.product?.name,
      status: data?.product?.status,
    });

    return data;
  } catch (error: any) {
    console.error("[create-product] Error:", error);

    if (error?.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      message: error?.message || "Failed to create product",
    });
  }
});
