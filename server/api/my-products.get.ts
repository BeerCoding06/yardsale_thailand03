// server/api/my-products.get.ts
// ดึงข้อมูล products ที่ผู้ใช้ลงขาย (post_author = user_id)

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const userId = query.user_id;

    if (!userId) {
      throw createError({
        statusCode: 400,
        message: "user_id is required",
      });
    }

    // เรียก PHP API endpoint
    const config = useRuntimeConfig();
    const baseUrl = config.baseUrl || "http://localhost/yardsale_thailand";
    const phpApiUrl = `${baseUrl}/server/api/php/myProducts.php?user_id=${userId}`;

    console.log("[my-products] Calling PHP API:", phpApiUrl);

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
      } catch (e) {
        /* not JSON */
      }
      console.error("[my-products] PHP API Error:", errorMessage);
      throw createError({
        statusCode: response.status,
        message: errorMessage,
      });
    }

    const data = await response.json();
    console.log("[my-products] Successfully fetched products:", {
      count: data.count,
    });

    return data;
  } catch (error: any) {
    console.error("[my-products] Error:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to fetch user products",
    });
  }
});
