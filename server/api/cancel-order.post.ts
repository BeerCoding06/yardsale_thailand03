// server/api/cancel-order.post.ts
// Cancel order using WooCommerce REST API

import * as wpUtils from '../utils/wp';

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

    // Check WooCommerce credentials
    const consumerKey = wpUtils.getWpConsumerKey();
    const consumerSecret = wpUtils.getWpConsumerSecret();
    
    if (!consumerKey || !consumerSecret) {
      throw createError({
        statusCode: 500,
        message: "WooCommerce Consumer Key/Secret is not configured",
      });
    }

    // First, verify the order exists and belongs to the customer
    const wcUrl = wpUtils.buildWcApiUrl(`wc/v3/orders/${orderId}`);
    
    const getResponse = await fetch(wcUrl, {
      method: "GET",
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!getResponse.ok) {
      throw createError({
        statusCode: getResponse.status,
        message: "Order not found",
      });
    }

    const existingOrder = await getResponse.json();

    // Verify ownership if customerId is provided
    if (customerId && existingOrder.customer_id && parseInt(existingOrder.customer_id) !== parseInt(customerId)) {
      throw createError({
        statusCode: 403,
        message: "You don't have permission to cancel this order",
      });
    }

    // Update order status to cancelled
    console.log("[cancel-order] Cancelling order via WooCommerce API:", wcUrl.replace(/consumer_secret=[^&]+/, 'consumer_secret=***'));

    const response = await fetch(wcUrl, {
      method: "PUT",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'cancelled'
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
      console.error("[cancel-order] WooCommerce API Error:", errorMessage);
      throw createError({
        statusCode: response.status,
        message: errorMessage,
      });
    }

    const data = await response.json();
    console.log("[cancel-order] Successfully cancelled order:", {
      orderId: data.id,
      status: data.status,
    });

    return {
      order: data
    };
  } catch (error: any) {
    console.error("[cancel-order] Error:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to cancel order",
    });
  }
});

