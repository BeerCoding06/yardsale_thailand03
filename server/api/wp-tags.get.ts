// server/api/wp-tags.get.ts
// ดึง WooCommerce Product Tags ทั้งหมดจาก WordPress REST API

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig();

    console.log("[wp-tags] Config:", {
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

    console.log("[wp-tags] WordPress base URL:", cleanBase);

    // WooCommerce Product Tags endpoint
    // ดึงทั้งหมดโดยใช้ pagination
    let allTags: any[] = [];
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

    // WooCommerce Product Tags endpoint
    while (hasMore && page <= maxPages) {
      const apiUrl = `${cleanBase}/wp-json/wc/v3/products/tags?per_page=${perPage}&page=${page}&orderby=name&order=asc`;

      console.log(`[wp-tags] Fetching tags page ${page} from:`, apiUrl);

      const res = await fetch(apiUrl, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let errorMessage = `Failed to fetch tags from WordPress (status ${res.status})`;

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
          "[wp-tags] Error fetching tags:",
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

      const tags = await res.json();
      allTags = allTags.concat(tags);

      // ตรวจสอบว่ามีข้อมูลมากกว่า per_page หรือไม่
      const totalPages = parseInt(res.headers.get("x-wp-totalpages") || "1");
      hasMore = page < totalPages;
      page++;

      console.log(
        `[wp-tags] Fetched ${tags.length} tags (page ${page - 1}/${totalPages})`
      );
    }

    if (page > maxPages) {
      console.warn(
        `[wp-tags] Reached maxPages limit (${maxPages}). Not all tags might have been fetched.`
      );
    }

    console.log("[wp-tags] Total tags fetched:", allTags.length);

    // Return tags in a simple format
    return allTags.map((tag: any) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      count: tag.count || 0,
    }));
  } catch (error: any) {
    console.error("[wp-tags] Error details:", {
      message: error?.message,
      statusCode: error?.statusCode,
      stack: error?.stack?.substring(0, 500),
    });

    if (error?.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: error?.statusCode || 500,
      message: error?.message || "Failed to fetch tags from WordPress",
      data: {
        originalError: error?.message,
        url: error?.url || "unknown",
      },
    });
  }
});
