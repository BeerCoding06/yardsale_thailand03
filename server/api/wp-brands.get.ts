// server/api/wp-brands.get.ts
// ดึง WooCommerce Product Brands ทั้งหมดจาก WordPress REST API

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig();

    console.log("[wp-brands] Config:", {
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

    console.log("[wp-brands] WordPress base URL:", cleanBase);

    // WooCommerce Product Brands endpoint
    // ดึงทั้งหมดโดยใช้ pagination
    let allBrands: any[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;
    const maxPages = 100; // Prevent infinite loops

    // ใช้ Basic Auth สำหรับ WooCommerce REST API
    const wpBasicAuth = config.wpBasicAuth;

    if (!wpBasicAuth) {
      throw createError({
        statusCode: 500,
        message:
          "WP_BASIC_AUTH is not configured in .env file. Please add WP_BASIC_AUTH to your .env file.",
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Basic ${wpBasicAuth}`,
    };

    // WooCommerce Product Brands endpoint
    // Note: Brands might be a custom taxonomy, so we try both endpoints
    while (hasMore && page <= maxPages) {
      // Try WooCommerce brands endpoint first
      let apiUrl = `${cleanBase}/wp-json/wc/v3/products/brands?per_page=${perPage}&page=${page}&orderby=name&order=asc`;

      console.log(`[wp-brands] Fetching brands page ${page} from:`, apiUrl);

      let res = await fetch(apiUrl, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(10000),
      });

      // If brands endpoint doesn't exist, try WordPress taxonomy endpoint
      if (!res.ok && res.status === 404) {
        console.log(
          "[wp-brands] Brands endpoint not found, trying taxonomy endpoint..."
        );
        apiUrl = `${cleanBase}/wp-json/wp/v2/product_brand?per_page=${perPage}&page=${page}&orderby=name&order=asc`;

        res = await fetch(apiUrl, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(10000),
        });
      }

      if (!res.ok) {
        // If still not found, return empty array (brands might not be configured)
        if (res.status === 404) {
          console.log(
            "[wp-brands] Brands taxonomy not found, returning empty array"
          );
          return [];
        }

        const text = await res.text().catch(() => "");
        let errorMessage = `Failed to fetch brands from WordPress (status ${res.status})`;

        try {
          const errorJson = JSON.parse(text);
          if (errorJson.message) {
            errorMessage = errorJson.message;
          }
        } catch (e) {
          if (text) {
            errorMessage = `${errorMessage}: ${text.substring(0, 200)}`;
          }
        }

        console.error(
          "[wp-brands] Error fetching brands:",
          res.status,
          errorMessage
        );

        if (res.status === 401 || res.status === 403) {
          throw createError({
            statusCode: 502,
            message: `Authentication failed. Please check WP_BASIC_AUTH in .env file. Original error: ${errorMessage}`,
          });
        }

        throw createError({
          statusCode: 502,
          message: errorMessage,
        });
      }

      const brands = await res.json();
      allBrands = allBrands.concat(brands);

      // ตรวจสอบว่ามีข้อมูลมากกว่า per_page หรือไม่
      const totalPages = parseInt(res.headers.get("x-wp-totalpages") || "1");
      hasMore = page < totalPages;
      page++;

      console.log(
        `[wp-brands] Fetched ${brands.length} brands (page ${
          page - 1
        }/${totalPages})`
      );
    }

    if (page > maxPages) {
      console.warn(
        `[wp-brands] Reached maxPages limit (${maxPages}). Not all brands might have been fetched.`
      );
    }

    console.log("[wp-brands] Total brands fetched:", allBrands.length);

    // Return brands in a simple format
    return allBrands.map((brand: any) => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      count: brand.count || 0,
    }));
  } catch (error: any) {
    console.error("[wp-brands] Error details:", {
      message: error?.message,
      statusCode: error?.statusCode,
      stack: error?.stack?.substring(0, 500),
    });

    if (error?.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: error?.statusCode || 500,
      message: error?.message || "Failed to fetch brands from WordPress",
      data: {
        originalError: error?.message,
        url: error?.url || "unknown",
      },
    });
  }
});
