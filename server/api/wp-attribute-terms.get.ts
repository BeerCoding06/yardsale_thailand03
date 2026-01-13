// server/api/wp-attribute-terms.get.ts
// ดึง WooCommerce Product Attribute Terms จาก WordPress REST API

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const attribute = query.attribute as string; // e.g., "pa_color", "pa_style"

    if (!attribute) {
      throw createError({
        statusCode: 400,
        message: "Attribute name is required. Use ?attribute=pa_color",
      });
    }

    const config = useRuntimeConfig();

    console.log("[wp-attribute-terms] Config:", {
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

    console.log("[wp-attribute-terms] WordPress base URL:", cleanBase);
    console.log("[wp-attribute-terms] Fetching attribute:", attribute);

    // WordPress REST API endpoint สำหรับดึง attribute terms
    // Format: /wp-json/wp/v2/{attribute}
    const termsUrl = `${cleanBase}/wp-json/wp/v2/${attribute}?per_page=100&orderby=name&order=asc`;

    // ใช้ Basic Auth สำหรับ WordPress REST API
    const wpBasicAuth = config.wpBasicAuth;

    if (!wpBasicAuth) {
      throw createError({
        statusCode: 500,
        message: "WP_BASIC_AUTH is not configured",
      });
    }

    console.log("[wp-attribute-terms] Fetching from:", termsUrl);

    const response = await fetch(termsUrl, {
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

      console.error("[wp-attribute-terms] Error:", errorMessage);

      // If 404, return empty array (attribute might not exist)
      if (response.status === 404) {
        console.warn(
          "[wp-attribute-terms] Attribute not found, returning empty array"
        );
        return [];
      }

      throw createError({
        statusCode: response.status,
        message: errorMessage,
      });
    }

    const termsData = await response.json();

    // Transform to simpler format
    const terms = Array.isArray(termsData)
      ? termsData.map((term: any) => ({
          id: term.id,
          name: term.name,
          slug: term.slug,
        }))
      : [];

    console.log("[wp-attribute-terms] Success:", {
      attribute,
      count: terms.length,
    });

    return terms;
  } catch (error: any) {
    console.error("[wp-attribute-terms] Error:", error);

    if (error?.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      message: error?.message || "Failed to fetch attribute terms",
    });
  }
});
