// server/api/seller-orders.get.ts
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const config = useRuntimeConfig();
    const baseUrl = config.baseUrl || "http://localhost/yardsale_thailand";
    
    const sellerId = query.seller_id;

    if (!sellerId) {
      throw createError({
        statusCode: 400,
        message: "seller_id is required",
      });
    }

    const phpApiUrl = `${baseUrl}/server/api/php/sellerOrders.php?${new URLSearchParams({
      seller_id: String(sellerId),
    })}`;

    console.log("[seller-orders] Calling PHP API:", phpApiUrl);

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
      console.error("[seller-orders] PHP API Error:", errorMessage);
      console.error("[seller-orders] Error details:", errorDetails);
      throw createError({
        statusCode: response.status,
        message: errorMessage,
        data: errorDetails,
      });
    }

    const data = await response.json();
    console.log("[seller-orders] Successfully fetched orders:", {
      count: data.count,
    });

    return data;
  } catch (error: any) {
    console.error("[seller-orders] Error:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to fetch seller orders",
    });
  }
});

