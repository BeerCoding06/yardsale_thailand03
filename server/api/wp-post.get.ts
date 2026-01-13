// server/api/wp-post.get.ts
// ดึงข้อมูล WordPress Post หรือ WooCommerce Product จาก REST API

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const postId = query.id || query.post_id;

    if (!postId) {
      throw createError({
        statusCode: 400,
        message: "Post ID is required. Use ?id=1068 or ?post_id=1068",
      });
    }

    const config = useRuntimeConfig();
    const baseUrl = config.baseUrl || "http://localhost/yardsale_thailand";
    let wpBase = config.wpMediaHost || `${baseUrl}/wordpress`;
    if (!wpBase.match(/^https?:\/\//)) {
      wpBase = `http://${wpBase}`;
    }
    const cleanBase = wpBase.replace(/\/$/, "");
    const wpBasicAuth = config.wpBasicAuth;

    if (!wpBasicAuth) {
      throw createError({
        statusCode: 500,
        message: "WP_BASIC_AUTH is not configured",
      });
    }

    const headers = {
      Authorization: `Basic ${wpBasicAuth}`,
      "Content-Type": "application/json",
    };

    // 1. Try fetching as a WooCommerce Product
    const productUrl = `${cleanBase}/wp-json/wc/v3/products/${postId}`;
    console.log(
      "[wp-post] Attempting to fetch as WooCommerce Product:",
      productUrl
    );

    let response = await fetch(productUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(30000),
    });

    if (response.ok) {
      const productData = await response.json();
      console.log("[wp-post] Successfully fetched WooCommerce Product:", {
        id: productData.id,
        name: productData.name || "N/A",
        type: productData.type,
        status: productData.status,
      });
      return productData;
    } else if (response.status !== 404) {
      // If it's not a 404, it's an actual error for the product endpoint
      const errorText = await response.text().catch(() => "");
      let errorMessage = `WooCommerce Product API error (status ${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) errorMessage = errorJson.message;
      } catch (e) {
        /* not JSON */
      }
      console.error("[wp-post] WooCommerce Product Error:", errorMessage);
      throw createError({ statusCode: response.status, message: errorMessage });
    }

    // 2. Fallback: Try fetching as a generic WordPress Post
    const postUrl = `${cleanBase}/wp-json/wp/v2/posts/${postId}`;
    console.log("[wp-post] Falling back to fetch as WordPress Post:", postUrl);

    response = await fetch(postUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let errorMessage = `WordPress Post API error (status ${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) errorMessage = errorJson.message;
      } catch (e) {
        /* not JSON */
      }
      console.error("[wp-post] WordPress Post Error:", errorMessage);
      throw createError({ statusCode: response.status, message: errorMessage });
    }

    const postData = await response.json();
    console.log("[wp-post] Successfully fetched WordPress Post:", {
      id: postData.id,
      title: postData.title?.rendered || "N/A",
      status: postData.status,
    });
    return postData;
  } catch (error: any) {
    console.error("[wp-post] Error:", error);
    if (error?.statusCode) throw error;
    throw createError({
      statusCode: 500,
      message: error?.message || "Failed to fetch post",
    });
  }
});
