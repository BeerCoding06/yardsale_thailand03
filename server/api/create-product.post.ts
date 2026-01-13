// server/api/create-product.post.ts
// Nuxt API endpoint ที่เรียก PHP API สำหรับสร้าง WooCommerce products

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    console.log("[create-product] Received payload:", {
      name: body.name,
      type: body.type,
      regular_price: body.regular_price,
      categories: body.categories,
      imagesCount: body.images?.length || 0,
      images: body.images,
      post_author: body.post_author,
    });

    // Log full payload for debugging
    console.log(
      "[create-product] Full payload:",
      JSON.stringify(body, null, 2)
    );

    // ใช้ PHP API endpoint โดยเรียกผ่าน HTTP
    // หรือใช้ Node.js เรียก PHP file โดยตรง
    // แต่เนื่องจาก Nuxt ไม่สามารถรัน PHP ได้ ต้องเรียกผ่าน HTTP

    const config = useRuntimeConfig();
    const baseUrl = config.baseUrl || "http://localhost/yardsale_thailand";
    let wpBase = config.wpMediaHost || `${baseUrl}/wordpress`;
    if (!wpBase.match(/^https?:\/\//)) {
      wpBase = `http://${wpBase}`;
    }
    const cleanBase = wpBase.replace(/\/$/, "");

    // เรียก PHP API ผ่าน HTTP
    // PHP file อยู่ใน /server/api/php/createProducts.php
    // ต้องเรียกผ่าน MAMP/Apache (ไม่ใช่ Nuxt)
    const phpApiUrl = `${baseUrl}/server/api/php/createProducts.php`;

    console.log("[create-product] Calling PHP API:", phpApiUrl);

    let response;
    try {
      response = await fetch(phpApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });
    } catch (fetchError: any) {
      console.error("[create-product] Fetch error:", fetchError);
      throw createError({
        statusCode: 500,
        message: `Failed to connect to PHP API: ${
          fetchError?.message || "Network error"
        }`,
      });
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let errorMessage = `PHP API error (status ${response.status})`;
      let errorDetails = null;

      console.error("[create-product] PHP API error response:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText.substring(0, 500),
      });

      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error) {
          errorMessage = errorJson.error;
        }
        if (errorJson.message) {
          errorMessage = errorJson.message;
        }
        errorDetails = errorJson;
      } catch (e) {
        // Not JSON, use text as is
        if (errorText) {
          errorMessage = `${errorMessage}: ${errorText.substring(0, 500)}`;
        }
      }

      console.error(
        "[create-product] PHP API error:",
        errorMessage,
        errorDetails
      );

      throw createError({
        statusCode: response.status,
        message: errorMessage,
        data: errorDetails,
      });
    }

    const result = await response.json();

    console.log("[create-product] Success:", result);

    return result;
  } catch (error: any) {
    console.error("[create-product] Error:", error);

    if (error?.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      message: error?.message || "Failed to create product",
    });
  }
});
