// server/api/create-order.post.ts
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const config = useRuntimeConfig();
    const baseUrl = config.baseUrl || "http://localhost/yardsale_thailand";
    const phpApiUrl = `${baseUrl}/server/api/php/createOrder.php`;

    console.log("[create-order] Calling PHP API:", phpApiUrl);
    console.log("[create-order] Payload:", JSON.stringify(body, null, 2));

    const response = await fetch(phpApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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
      console.error("[create-order] PHP API Error:", errorMessage);
      throw createError({
        statusCode: response.status,
        message: errorMessage,
      });
    }

    const data = await response.json();
    console.log("[create-order] Successfully created order:", {
      id: data.order?.id,
      order_number: data.order?.number,
      status: data.order?.status,
    });

    return data;
  } catch (error: any) {
    console.error("[create-order] Error:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to create order",
    });
  }
});

