// server/api/my-orders.get.ts
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const config = useRuntimeConfig();
    const baseUrl = config.baseUrl || "http://localhost/yardsale_thailand";
    
    const customerId = query.customer_id;
    const customerEmail = query.customer_email;

    if (!customerId && !customerEmail) {
      throw createError({
        statusCode: 400,
        message: "customer_id or customer_email is required",
      });
    }

    const phpApiUrl = `${baseUrl}/server/api/php/myOrders.php?${new URLSearchParams({
      ...(customerId ? { customer_id: String(customerId) } : {}),
      ...(customerEmail ? { customer_email: String(customerEmail) } : {}),
    })}`;

    console.log("[my-orders] Calling PHP API:", phpApiUrl);

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
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error) errorMessage = errorJson.error;
        else if (errorJson.message) errorMessage = errorJson.message;
      } catch (e) {
        /* not JSON */
      }
      console.error("[my-orders] PHP API Error:", errorMessage);
      throw createError({
        statusCode: response.status,
        message: errorMessage,
      });
    }

    const data = await response.json();
    console.log("[my-orders] Successfully fetched orders:", {
      count: data.count,
    });

    return data;
  } catch (error: any) {
    console.error("[my-orders] Error:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to fetch orders",
    });
  }
});

