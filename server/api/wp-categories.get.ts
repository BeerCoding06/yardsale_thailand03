// server/api/wp-categories.get.ts
// ดึง WooCommerce Product Categories ทั้งหมดจาก WordPress REST API

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig();

    console.log("[wp-categories] Config:", {
      wpMediaHost: config.wpMediaHost ? "***" : "missing",
      wpBasicAuth: config.wpBasicAuth ? "***" : "missing",
      wcConsumerKey: config.wcConsumerKey ? "***" : "missing",
      wcConsumerSecret: config.wcConsumerSecret ? "***" : "missing",
    });

    // ใช้ URL จาก config หรือ default
    const baseUrl = config.baseUrl || "http://localhost/yardsale_thailand";
    let wpBase = config.wpMediaHost || `${baseUrl}/wordpress`;

    // ถ้า URL ไม่มี protocol ให้เพิ่ม http://
    if (!wpBase.match(/^https?:\/\//)) {
      wpBase = `http://${wpBase}`;
    }

    const cleanBase = wpBase.replace(/\/$/, "");

    console.log("[wp-categories] WordPress base URL:", cleanBase);

    // WooCommerce Product Categories endpoint
    // ดึงทั้งหมดโดยใช้ pagination
    let allCategories: any[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    // ใช้ Basic Auth สำหรับ WooCommerce REST API
    // WooCommerce REST API ต้องการ authentication สำหรับ categories endpoint
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

    while (hasMore) {
      const apiUrl = `${cleanBase}/wp-json/wc/v3/products/categories?per_page=${perPage}&page=${page}&orderby=name&order=asc`;

      console.log(
        `[wp-categories] Fetching categories page ${page} from:`,
        apiUrl
      );

      const res = await fetch(apiUrl, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let errorMessage = `Failed to fetch categories from WordPress (status ${res.status})`;

        try {
          const errorJson = JSON.parse(text);
          if (errorJson.message) {
            errorMessage = errorJson.message;
          }
        } catch (e) {
          // Not JSON, use text as is
          if (text) {
            errorMessage = `${errorMessage}: ${text.substring(0, 200)}`;
          }
        }

        console.error(
          "[wp-categories] Error fetching categories:",
          res.status,
          errorMessage
        );

        // ถ้าเป็น error 401/403 อาจเป็นปัญหา authentication
        if (res.status === 401 || res.status === 403) {
          throw createError({
            statusCode: 502,
            message: `Authentication failed. Please check WP_BASIC_AUTH or WC_CONSUMER_KEY/SECRET in .env file. Original error: ${errorMessage}`,
          });
        }

        throw createError({
          statusCode: 502,
          message: errorMessage,
        });
      }

      let categories;
      try {
        categories = await res.json();
      } catch (parseError) {
        const text = await res.text().catch(() => "");
        console.error(
          "[wp-categories] Failed to parse JSON response:",
          text.substring(0, 500)
        );
        throw createError({
          statusCode: 502,
          message: "Invalid JSON response from WordPress API",
        });
      }

      // ตรวจสอบว่า categories เป็น array หรือไม่
      if (!Array.isArray(categories)) {
        console.error(
          "[wp-categories] Unexpected response format:",
          typeof categories,
          JSON.stringify(categories).substring(0, 200)
        );
        throw createError({
          statusCode: 502,
          message:
            "Invalid response format from WordPress API (expected array)",
        });
      }

      allCategories = allCategories.concat(categories);

      // ตรวจสอบว่ามีข้อมูลมากกว่า per_page หรือไม่
      const totalPagesHeader = res.headers.get("x-wp-totalpages");
      const totalPages = totalPagesHeader ? parseInt(totalPagesHeader) : 1;
      hasMore = page < totalPages;
      page++;

      // ป้องกัน infinite loop
      if (page > 100) {
        console.warn(
          "[wp-categories] Reached maximum page limit (100), stopping pagination"
        );
        hasMore = false;
      }

      console.log(
        `[wp-categories] Fetched ${categories.length} categories (page ${
          page - 1
        }/${totalPages})`
      );
    }

    console.log(
      "[wp-categories] Total categories fetched:",
      allCategories.length
    );

    // Return categories in a simple format
    return allCategories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      count: cat.count || 0,
      parent: cat.parent || 0,
    }));
  } catch (error: any) {
    console.error("[wp-categories] Error details:", {
      message: error?.message,
      statusCode: error?.statusCode,
      stack: error?.stack?.substring(0, 500),
    });

    // ถ้า error มี statusCode อยู่แล้ว (จาก createError) ให้ throw ต่อ
    if (error?.statusCode) {
      throw error;
    }

    // ถ้าเป็น error อื่นๆ
    throw createError({
      statusCode: error?.statusCode || 500,
      message: error?.message || "Failed to fetch categories from WordPress",
      data: {
        originalError: error?.message,
        url: error?.url || "unknown",
      },
    });
  }
});
