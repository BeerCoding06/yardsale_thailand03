// server/api/cancel-product.post.ts
// API endpoint สำหรับยกเลิกสินค้า (เปลี่ยนสถานะเป็น draft)

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    const productId = body.product_id;
    const userId = body.user_id;

    if (!productId || !userId) {
      throw createError({
        statusCode: 400,
        message: "product_id and user_id are required",
      });
    }

    // เรียก PHP API endpoint
    const config = useRuntimeConfig();
    const baseUrl = config.baseUrl || "http://localhost/yardsale_thailand";
    const phpApiUrl = `${baseUrl}/server/api/php/cancelProduct.php`;

    console.log("[cancel-product] Calling PHP API:", phpApiUrl);

    const response = await fetch(phpApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_id: productId,
        user_id: userId,
      }),
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
      console.error("[cancel-product] PHP API Error:", errorMessage);
      throw createError({
        statusCode: response.status,
        message: errorMessage,
      });
    }

    const data = await response.json();
    console.log("[cancel-product] Successfully cancelled product:", {
      productId: data.product?.id,
      status: data.product?.status,
    });

    return data;
  } catch (error: any) {
    console.error("[cancel-product] Error:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to cancel product",
    });
  }
});
