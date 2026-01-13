// server/api/get-order.get.ts
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const config = useRuntimeConfig();
    const baseUrl = config.baseUrl || "http://localhost/yardsale_thailand";
    
    const orderId = query.order_id;
    const customerId = query.customer_id;

    if (!orderId) {
      throw createError({
        statusCode: 400,
        message: "order_id is required",
      });
    }

    const phpApiUrl = `${baseUrl}/server/api/php/getOrder.php?${new URLSearchParams({
      order_id: String(orderId),
      ...(customerId ? { customer_id: String(customerId) } : {}),
    })}`;

    console.log("[get-order] Calling PHP API:", phpApiUrl);

    const response = await fetch(phpApiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let errorMessage = `PHP API error (status ${response.status})`;
      let errorDetails = null;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error) errorMessage = errorJson.error;
        else if (errorJson.message) errorMessage = errorJson.message;
        errorDetails = errorJson;
      } catch (e) {
        /* not JSON */
        errorMessage = errorText || errorMessage;
      }
      console.error("[get-order] PHP API Error:", errorMessage);
      console.error("[get-order] Error details:", errorDetails);
      throw createError({
        statusCode: response.status,
        message: errorMessage,
        data: errorDetails,
      });
    }

    const data = await response.json();
    console.log("[get-order] Successfully fetched order:", data.order?.id);

    return data;
  } catch (error: any) {
    console.error("[get-order] Error:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to fetch order",
    });
  }
});

