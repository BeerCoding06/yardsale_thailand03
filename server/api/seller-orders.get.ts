// server/api/seller-orders.get.ts
// Fetch seller orders using WooCommerce REST API

import * as wpUtils from '~/server/utils/wp';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    
    const sellerId = query.seller_id;

    if (!sellerId) {
      throw createError({
        statusCode: 400,
        message: "seller_id is required",
      });
    }

    const wcHeaders = wpUtils.getWpApiHeaders(false, true); // Use WooCommerce auth
    
    if (!wcHeaders['Authorization']) {
      throw createError({
        statusCode: 500,
        message: "WooCommerce Consumer Key/Secret is not configured",
      });
    }

    // Fetch orders where seller_id matches the product author
    // Strategy: Get all orders, then filter by checking product authors
    // For better performance, we'll batch fetch products
    
    const wcUrl = wpUtils.buildWpApiUrl('wc/v3/orders', {
      per_page: 100,
      status: 'any', // Get all statuses
    });

    console.log("[seller-orders] Fetching orders from WooCommerce API:", wcUrl);

    const response = await fetch(wcUrl, {
      method: "GET",
      headers: wcHeaders,
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
      console.error("[seller-orders] WooCommerce API Error:", errorMessage);
      throw createError({
        statusCode: response.status,
        message: errorMessage,
      });
    }

    let orders = await response.json();
    
    // Collect all unique product IDs from orders
    const productIds = new Set<number>();
    for (const order of orders) {
      if (order.line_items && Array.isArray(order.line_items)) {
        for (const item of order.line_items) {
          if (item.product_id) {
            productIds.add(item.product_id);
          }
        }
      }
    }

    // Fetch products from WordPress REST API to get authors (more efficient)
    const wpHeaders = wpUtils.getWpApiHeaders(true, false);
    const productAuthors = new Map<number, number>(); // product_id -> author_id
    
    // Fetch products in batches
    const productIdArray = Array.from(productIds);
    for (let i = 0; i < productIdArray.length; i += 20) {
      const batch = productIdArray.slice(i, i + 20);
      const includeParam = batch.join(',');
      
      try {
        const wpProductsUrl = wpUtils.buildWpApiUrl('wp/v2/product', {
          include: includeParam,
          per_page: 20,
        });
        
        const productsResponse = await fetch(wpProductsUrl, {
          method: "GET",
          headers: wpHeaders,
          signal: AbortSignal.timeout(10000),
        });
        
        if (productsResponse.ok) {
          const products = await productsResponse.json();
          for (const product of products) {
            if (product.author) {
              productAuthors.set(product.id, product.author);
            }
          }
        }
      } catch (e) {
        console.warn("[seller-orders] Error fetching product authors:", e);
      }
    }
    
    // Filter orders by seller_id
    const sellerOrders = orders.filter((order: any) => {
      if (order.line_items && Array.isArray(order.line_items)) {
        for (const item of order.line_items) {
          if (item.product_id) {
            const authorId = productAuthors.get(item.product_id);
            if (authorId && parseInt(authorId.toString()) === parseInt(sellerId as string)) {
              return true; // Found a product from this seller
            }
          }
        }
      }
      return false;
    });

    console.log("[seller-orders] Successfully fetched seller orders:", {
      count: sellerOrders.length,
    });

    return {
      orders: sellerOrders,
      count: sellerOrders.length
    };
  } catch (error: any) {
    console.error("[seller-orders] Error:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to fetch seller orders",
    });
  }
});

