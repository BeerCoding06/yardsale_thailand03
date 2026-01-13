// server/api/get-customer-data.get.ts
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

    const phpApiUrl = `${baseUrl}/server/api/php/getCustomerData.php?${new URLSearchParams({
      ...(customerId ? { customer_id: String(customerId) } : {}),
      ...(customerEmail ? { customer_email: String(customerEmail) } : {}),
    })}`;

    console.log("[get-customer-data] Calling PHP API:", phpApiUrl);

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
      console.error("[get-customer-data] PHP API Error:", errorMessage);
      console.error("[get-customer-data] Error details:", errorDetails);
      throw createError({
        statusCode: response.status,
        message: errorMessage,
        data: errorDetails,
      });
    }

    const data = await response.json();
    console.log("[get-customer-data] Successfully fetched customer data");

    return data;
  } catch (error: any) {
    console.error("[get-customer-data] Error:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to fetch customer data",
    });
  }
});

