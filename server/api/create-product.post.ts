// server/api/create-product.post.ts
// Create product using WooCommerce REST API

import * as wpUtils from '../utils/wp';

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

    const consumerKey = wpUtils.getWpConsumerKey();
    const consumerSecret = wpUtils.getWpConsumerSecret();
    
    if (!consumerKey || !consumerSecret) {
      throw createError({
        statusCode: 500,
        message: "WooCommerce Consumer Key/Secret is not configured",
      });
    }

    // Format product data for WooCommerce REST API
    const productData: any = {
      name: body.name,
      type: body.type || 'simple',
      regular_price: body.regular_price || '0',
      status: 'pending', // New products start as pending for review
    };

    // Add categories if provided
    if (body.categories && Array.isArray(body.categories)) {
      productData.categories = body.categories.map((cat: any) => ({
        id: cat.id || cat
      }));
    }

    // Add images if provided
    if (body.images && Array.isArray(body.images)) {
      productData.images = body.images.map((img: any) => ({
        src: img.src || img.url || img
      }));
    }

    // Add description if provided
    if (body.description) {
      productData.description = body.description;
    }

    // Add short_description if provided
    if (body.short_description) {
      productData.short_description = body.short_description;
    }

    // Add SKU if provided
    if (body.sku) {
      productData.sku = body.sku;
    }

    // Add stock management if provided
    if (body.manage_stock !== undefined) {
      productData.manage_stock = body.manage_stock;
    }
    if (body.stock_quantity !== undefined) {
      productData.stock_quantity = body.stock_quantity;
    }

    const wcUrl = wpUtils.buildWcApiUrl('wc/v3/products');
    
    console.log("[create-product] Creating product via WooCommerce API:", wcUrl.replace(/consumer_secret=[^&]+/, 'consumer_secret=***'));

    const response = await fetch(wcUrl, {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let errorMessage = `WooCommerce API error (status ${response.status})`;
      let errorDetails = null;

      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) errorMessage = errorJson.message;
        if (errorJson.code) errorMessage = `${errorMessage} (${errorJson.code})`;
        errorDetails = errorJson;
      } catch (e) {
        if (errorText) errorMessage = `${errorMessage}: ${errorText.substring(0, 500)}`;
      }

      console.error("[create-product] WooCommerce API error:", errorMessage, errorDetails);
      throw createError({
        statusCode: response.status,
        message: errorMessage,
        data: errorDetails,
      });
    }

    const result = await response.json();

    console.log("[create-product] Successfully created product:", {
      id: result.id,
      name: result.name,
      status: result.status,
    });

    return {
      product: result
    };
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
