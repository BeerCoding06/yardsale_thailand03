// server/api/wp-attributes.get.ts
// ดึงรายการ WooCommerce Product Attributes ทั้งหมดจาก WordPress REST API

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig();

    console.log("[wp-attributes] Config:", {
      wpMediaHost: config.wpMediaHost ? "***" : "missing",
      wpBasicAuth: config.wpBasicAuth ? "***" : "missing",
    });

    // ใช้ URL จาก config หรือ default
    const baseUrl = config.baseUrl || "http://localhost/yardsale_thailand";
    let wpBase = config.wpMediaHost || `${baseUrl}/wordpress`;

    // ถ้า URL ไม่มี protocol ให้เพิ่ม http://
    if (!wpBase.match(/^https?:\/\//)) {
      wpBase = `http://${wpBase}`;
    }

    const cleanBase = wpBase.replace(/\/$/, "");

    console.log("[wp-attributes] WordPress base URL:", cleanBase);

    // WooCommerce Product Attributes endpoint
    const attributesUrl = `${cleanBase}/wp-json/wc/v3/products/attributes`;

    // ใช้ Basic Auth สำหรับ WooCommerce REST API
    const wpBasicAuth = config.wpBasicAuth;

    if (!wpBasicAuth) {
      throw createError({
        statusCode: 500,
        message: "WP_BASIC_AUTH is not configured",
      });
    }

    console.log("[wp-attributes] Fetching from:", attributesUrl);

    const response = await fetch(attributesUrl, {
      method: "GET",
      headers: {
        Authorization: `Basic ${wpBasicAuth}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let errorMessage = `WordPress API error (status ${response.status})`;

      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
          errorMessage = errorJson.message;
        }
        if (errorJson.code) {
          errorMessage = `${errorMessage} (${errorJson.code})`;
        }
      } catch (e) {
        if (errorText) {
          errorMessage = `${errorMessage}: ${errorText.substring(0, 200)}`;
        }
      }

      console.error("[wp-attributes] Error:", errorMessage);

      throw createError({
        statusCode: response.status,
        message: errorMessage,
      });
    }

    const attributesData = await response.json();

    // Transform to simpler format
    const attributes = Array.isArray(attributesData)
      ? attributesData.map((attr: any) => ({
          id: attr.id,
          name: attr.name,
          slug: attr.slug,
          type: attr.type || "select",
          order_by: attr.order_by || "menu_order",
          has_archives: attr.has_archives || false,
        }))
      : [];

    console.log("[wp-attributes] Success:", {
      count: attributes.length,
    });

    return attributes;
  } catch (error: any) {
    console.error("[wp-attributes] Error:", error);

    if (error?.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      message: error?.message || "Failed to fetch product attributes",
    });
  }
});
