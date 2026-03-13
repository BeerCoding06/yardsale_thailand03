// server/api/update-profile.post.ts
// Update user profile using WordPress REST API
// ใช้ JWT ของ user (จาก login) เรียก WP — จะได้แก้ชื่อ/นามสกุลได้โดยไม่ต้องกรอกรหัสผ่าน

import * as wpUtils from '../utils/wp';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    
    const userId = body.user_id || body.id;
    const token = body.token || getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '');

    if (!userId) {
      throw createError({
        statusCode: 400,
        message: "user_id is required",
      });
    }

    // ใช้ JWT ของ user ถ้ามี — WordPress จะถือว่าเป็นผู้ใช้แก้ไขตัวเอง ไม่ต้องส่งรหัสผ่าน
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      const basicHeaders = wpUtils.getWpApiHeaders(true, false);
      if (basicHeaders['Authorization']) {
        headers['Authorization'] = basicHeaders['Authorization'];
      } else {
        throw createError({
          statusCode: 500,
          message: "ส่ง token (จาก login) หรือตั้ง WP_BASIC_AUTH",
        });
      }
    }

    const updateData: any = {};
    if (body.first_name !== undefined) updateData.first_name = body.first_name;
    if (body.last_name !== undefined) updateData.last_name = body.last_name;
    if (body.display_name !== undefined) updateData.name = body.display_name;
    if (body.description !== undefined) updateData.description = body.description;

    // Update meta fields (billing info) if provided
    if (body.billing) {
      updateData.meta = {
        billing_first_name: body.billing.first_name || body.billing.firstName || '',
        billing_last_name: body.billing.last_name || body.billing.lastName || '',
        billing_phone: body.billing.phone || '',
        billing_address_1: body.billing.address1 || body.billing.address_1 || '',
        billing_address_2: body.billing.address2 || body.billing.address_2 || '',
        billing_city: body.billing.city || '',
        billing_state: body.billing.state || '',
        billing_postcode: body.billing.postcode || '',
        billing_country: body.billing.country || '',
      };
    }

    const wpUrl = wpUtils.buildWpApiUrl(`wp/v2/users/${userId}`);
    
    console.log("[update-profile] Updating profile via WordPress API:", wpUrl);

    const response = await fetch(wpUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(updateData),
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
      console.error("[update-profile] WordPress API Error:", errorMessage);
      throw createError({
        statusCode: response.status,
        message: errorMessage,
        data: errorDetails,
      });
    }

    const data = await response.json();
    
    // Remove sensitive data
    const { password, ...safeData } = data;
    
    console.log("[update-profile] Successfully updated profile");

    return {
      success: true,
      user: safeData
    };
  } catch (error: any) {
    console.error("[update-profile] Error:", error);
    
    if (error.statusCode) {
      throw createError({
        statusCode: error.statusCode,
        message: error.message || "Failed to update profile",
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
      message: error.message || "Failed to update profile",
    });
  }
});

