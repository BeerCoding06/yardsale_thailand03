// server/api/change-password.post.ts
// Change user password using WordPress REST API

import * as wpUtils from '~/server/utils/wp';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    
    const userId = body.user_id || body.id;
    const newPassword = body.new_password || body.password;

    if (!userId || !newPassword) {
      throw createError({
        statusCode: 400,
        message: "user_id and new_password are required",
      });
    }

    const headers = wpUtils.getWpApiHeaders(true, false); // Use Basic Auth for WP REST API
    
    if (!headers['Authorization']) {
      throw createError({
        statusCode: 500,
        message: "WP_BASIC_AUTH is not configured",
      });
    }

    // Update password via WordPress REST API
    const wpUrl = wpUtils.buildWpApiUrl(`wp/v2/users/${userId}`);
    
    console.log("[change-password] Changing password via WordPress API:", wpUrl);

    const response = await fetch(wpUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        password: newPassword
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let errorMessage = `WordPress API error (status ${response.status})`;
      let errorDetails = null;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) errorMessage = errorJson.message;
        errorDetails = errorJson;
      } catch (e) {
        if (errorText) errorMessage = `${errorMessage}: ${errorText.substring(0, 200)}`;
      }
      console.error("[change-password] WordPress API Error:", errorMessage);
      throw createError({
        statusCode: response.status,
        message: errorMessage,
        data: errorDetails,
      });
    }

    const data = await response.json();
    
    // Remove sensitive data
    const { password, ...safeData } = data;
    
    console.log("[change-password] Successfully changed password");

    return {
      success: true,
      user: safeData
    };
  } catch (error: any) {
    console.error("[change-password] Error:", error);
    
    if (error.statusCode) {
      throw createError({
        statusCode: error.statusCode,
        message: error.message || "Failed to change password",
        data: error.data,
      });
    }
    
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw createError({
        statusCode: 504,
        message: "Request timeout. Please try again.",
      });
    }
    
    throw createError({
      statusCode: 500,
      message: error.message || "Failed to change password",
    });
  }
});

