// server/api/cancel-product.post.ts
// Cancel product using WooCommerce REST API (set status to draft)

import * as wpUtils from '../utils/wp';

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

    // Check WooCommerce credentials
    const consumerKey = wpUtils.getWpConsumerKey();
    const consumerSecret = wpUtils.getWpConsumerSecret();
    
    if (!consumerKey || !consumerSecret) {
      throw createError({
        statusCode: 500,
        message: "WooCommerce Consumer Key/Secret is not configured",
      });
    }

    // First, verify the product exists and belongs to the user
    const wcUrl = wpUtils.buildWcApiUrl(`wc/v3/products/${productId}`);
    
    const getResponse = await fetch(wcUrl, {
      method: "GET",
      headers: { 'Content-Type': 'application/json' },
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
        message: "You don't have permission to cancel this product",
      });
    }

    // Update product status to draft
    console.log("[cancel-product] Cancelling product via WooCommerce API:", wcUrl.replace(/consumer_secret=[^&]+/, 'consumer_secret=***'));

    const response = await fetch(wcUrl, {
      method: "PUT",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'draft'
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
      console.error("[cancel-product] WooCommerce API Error:", errorMessage);
      throw createError({
        statusCode: response.status,
        message: errorMessage,
      });
    }

    const data = await response.json();
    console.log("[cancel-product] Successfully cancelled product:", {
      productId: data.id,
      status: data.status,
    });

    return {
      product: data
    };
  } catch (error: any) {
    console.error("[cancel-product] Error:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to cancel product",
    });
  }
});
