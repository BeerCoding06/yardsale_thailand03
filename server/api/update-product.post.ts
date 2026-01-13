// server/api/update-product.post.ts
// API endpoint สำหรับแก้ไขสินค้า - เปลี่ยนสถานะเป็น pending หลังแก้ไข

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
    const phpApiUrl = `${baseUrl}/server/api/php/updateProduct.php`;

    console.log("[update-product] Calling PHP API:", phpApiUrl);
    console.log("[update-product] Payload:", {
      product_id: productId,
      user_id: userId,
      name: body.name,
      hasImages: !!body.images,
    });

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
      } catch (e) {
        /* not JSON */
      }
      console.error("[update-product] PHP API Error:", errorMessage);
      throw createError({
        statusCode: response.status,
        message: errorMessage,
      });
    }

    const data = await response.json();
    console.log("[update-product] Successfully updated product:", {
      productId: data.product?.id,
      status: data.product?.status,
    });

    return data;
  } catch (error: any) {
    console.error("[update-product] Error:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to update product",
    });
  }
});
