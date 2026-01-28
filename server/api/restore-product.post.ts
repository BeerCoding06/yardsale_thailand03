// server/api/restore-product.post.ts
// Restore product using WooCommerce REST API (set status to pending for review)

import * as wpUtils from '~/server/utils/wp';

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

    const wcHeaders = wpUtils.getWpApiHeaders(false, true); // Use WooCommerce auth
    
    if (!wcHeaders['Authorization']) {
      throw createError({
        statusCode: 500,
        message: "WooCommerce Consumer Key/Secret is not configured",
      });
    }

    // First, verify the product exists and belongs to the user
    const wcUrl = wpUtils.buildWpApiUrl(`wc/v3/products/${productId}`);
    
    const getResponse = await fetch(wcUrl, {
      method: "GET",
      headers: wcHeaders,
      signal: AbortSignal.timeout(10000),
    });

    if (!getResponse.ok) {
      throw createError({
        statusCode: getResponse.status,
        message: "Product not found",
      });
    }

    const existingProduct = await getResponse.json();

    // Verify ownership if userId is provided
    if (userId && existingProduct.post_author && parseInt(existingProduct.post_author) !== parseInt(userId)) {
      throw createError({
        statusCode: 403,
        message: "You don't have permission to restore this product",
      });
    }

    // Update product status to pending
    console.log("[restore-product] Restoring product via WooCommerce API:", wcUrl);

    const response = await fetch(wcUrl, {
      method: "PUT",
      headers: wcHeaders,
      body: JSON.stringify({
        status: 'pending'
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let errorMessage = `WooCommerce API error (status ${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) errorMessage = errorJson.message;
      } catch (e) {
        if (errorText) errorMessage = `${errorMessage}: ${errorText.substring(0, 200)}`;
      }
      console.error("[restore-product] WooCommerce API Error:", errorMessage);
      throw createError({
        statusCode: response.status,
        message: errorMessage,
      });
    }

    const data = await response.json();
    console.log("[restore-product] Successfully restored product:", {
      productId: data.id,
      status: data.status,
    });

    return {
      product: data
    };
  } catch (error: any) {
    console.error("[restore-product] Error:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to restore product",
    });
  }
});
