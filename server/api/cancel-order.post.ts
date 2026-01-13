// server/api/cancel-order.post.ts
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const config = useRuntimeConfig();
    const baseUrl = config.baseUrl || "http://localhost/yardsale_thailand";
    
    const orderId = body.order_id;
    const customerId = body.customer_id;

    if (!orderId || !customerId) {
      throw createError({
        statusCode: 400,
        message: "order_id and customer_id are required",
      });
    }

    const phpApiUrl = `${baseUrl}/server/api/php/cancelOrder.php`;

    console.log("[cancel-order] Calling PHP API:", phpApiUrl);

    const response = await fetch(phpApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        order_id: orderId,
        customer_id: customerId,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let errorMessage = `PHP API error (status ${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error) errorMessage = errorJson.error;
        else if (errorJson.message) errorMessage = errorJson.message;
      } catch (e) {
        /* not JSON */
      }
      console.error("[cancel-order] PHP API Error:", errorMessage);
      throw createError({
        statusCode: response.status,
        message: errorMessage,
      });
    }

    const data = await response.json();
    console.log("[cancel-order] Successfully cancelled order:", orderId);

    return data;
  } catch (error: any) {
    console.error("[cancel-order] Error:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to cancel order",
    });
  }
});

