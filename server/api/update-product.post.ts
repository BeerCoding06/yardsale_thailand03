// server/api/update-product.post.ts
// Update product using WooCommerce REST API - set status to pending after update

import * as wpUtils from '../utils/wp.js';

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
    
    console.log("[update-product] Fetching product from WooCommerce API:", wcUrl);

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
        message: "You don't have permission to update this product",
      });
    }

    // Format update data for WooCommerce REST API
    const updateData: any = {
      status: 'pending', // Set to pending after update for review
    };

    if (body.name) updateData.name = body.name;
    if (body.description) updateData.description = body.description;
    if (body.short_description) updateData.short_description = body.short_description;
    if (body.regular_price) updateData.regular_price = body.regular_price;
    if (body.sale_price !== undefined) updateData.sale_price = body.sale_price;
    if (body.sku) updateData.sku = body.sku;

    // Update categories if provided
    if (body.categories && Array.isArray(body.categories)) {
      updateData.categories = body.categories.map((cat: any) => ({
        id: cat.id || cat
      }));
    }

    // Update images if provided
    if (body.images && Array.isArray(body.images)) {
      updateData.images = body.images.map((img: any) => ({
        src: img.src || img.url || img
      }));
    }

    // Update stock management if provided
    if (body.manage_stock !== undefined) updateData.manage_stock = body.manage_stock;
    if (body.stock_quantity !== undefined) updateData.stock_quantity = body.stock_quantity;
    if (body.stock_status) updateData.stock_status = body.stock_status;

    console.log("[update-product] Updating product via WooCommerce API:", wcUrl);
    console.log("[update-product] Update data:", JSON.stringify(updateData, null, 2));

    const response = await fetch(wcUrl, {
      method: "PUT",
      headers: wcHeaders,
      body: JSON.stringify(updateData),
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
      console.error("[update-product] WooCommerce API Error:", errorMessage);
      throw createError({
        statusCode: response.status,
        message: errorMessage,
      });
    }

    const data = await response.json();
    console.log("[update-product] Successfully updated product:", {
      productId: data.id,
      status: data.status,
    });

    return {
      product: data
    };
  } catch (error: any) {
    console.error("[update-product] Error:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to update product",
    });
  }
});
