// server/api/create-order.post.ts
// Create order using WooCommerce REST API

import * as wpUtils from '~/server/utils/wp';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    
    console.log("[create-order] Received payload:", JSON.stringify(body, null, 2));

    const wcHeaders = wpUtils.getWpApiHeaders(false, true); // Use WooCommerce auth
    
    if (!wcHeaders['Authorization']) {
      throw createError({
        statusCode: 500,
        message: "WooCommerce Consumer Key/Secret is not configured",
      });
    }

    // Format order data for WooCommerce REST API
    const orderData: any = {
      customer_id: body.customer_id,
      payment_method: body.payment_method || 'cod',
      payment_method_title: body.payment_method_title || 'ชำระเงินปลายทาง',
      set_paid: body.set_paid || false,
      status: body.status || 'pending',
      billing: body.billing || {},
      line_items: body.line_items || [],
    };

    const wcUrl = wpUtils.buildWpApiUrl('wc/v3/orders');
    
    console.log("[create-order] Creating order via WooCommerce API:", wcUrl);

    const response = await fetch(wcUrl, {
      method: "POST",
      headers: wcHeaders,
      body: JSON.stringify(orderData),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let errorMessage = `WooCommerce API error (status ${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) errorMessage = errorJson.message;
        else if (errorJson.code) errorMessage = `${errorMessage}: ${errorJson.code}`;
      } catch (e) {
        if (errorText) errorMessage = `${errorMessage}: ${errorText.substring(0, 200)}`;
      }
      console.error("[create-order] WooCommerce API Error:", errorMessage);
      throw createError({
        statusCode: response.status,
        message: errorMessage,
      });
    }

    const data = await response.json();
    console.log("[create-order] Successfully created order:", {
      id: data.id,
      order_number: data.number,
      status: data.status,
    });

    return {
      order: {
        id: data.id,
        number: data.number,
        status: data.status,
        ...data
      }
    };
  } catch (error: any) {
    console.error("[create-order] Error:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to create order",
    });
  }
});

