// server/api/check-email.get.ts
// ตรวจสอบว่าอีเมลมีอยู่ในระบบ WordPress หรือไม่

import * as wpUtils from '../utils/wp';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const email = query.email as string;

    if (!email || !email.trim()) {
      throw createError({
        statusCode: 400,
        message: "Email is required. Use ?email=test@example.com",
      });
    }
    
    const cleanBase = wpUtils.getWpBaseUrl();
    const headers = wpUtils.getWpApiHeaders(true, false);
    
    if (!headers['Authorization']) {
      throw createError({
        statusCode: 500,
        message: "WP_BASIC_AUTH is not configured",
      });
    }

    // WordPress Users REST API endpoint - search by email
    const searchUrl = wpUtils.buildWpApiUrl('wp/v2/users', {
      search: email.trim(),
      per_page: '100'
    });

    console.log("[check-email] Checking email:", email);
    console.log("[check-email] Search URL:", searchUrl);

    const response = await fetch(searchUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      // ถ้า search ไม่สำเร็จ ให้ถือว่าไม่มีอีเมลซ้ำ (เพื่อไม่ให้ block user)
      console.warn("[check-email] Search failed, assuming email is available");
      return { exists: false, email: email.trim() };
    }

    const users = await response.json();

    // ตรวจสอบว่ามีอีเมลซ้ำหรือไม่ (ตรวจสอบแบบ case-insensitive)
    const emailExists =
      Array.isArray(users) &&
      users.some(
        (user: any) =>
          typeof user.email === "string" &&
          user.email.trim().toLowerCase() === email.trim().toLowerCase()
      );

    console.log("[check-email] Email exists:", emailExists);

    return {
      exists: emailExists,
      email: email.trim(),
    };
  } catch (error: any) {
    console.error("[check-email] Error:", error);

    // ถ้าเกิด error ให้ถือว่าไม่มีอีเมลซ้ำ (เพื่อไม่ให้ block user)
    // แต่ log error เพื่อ debug
    if (error?.statusCode) {
      // ถ้าเป็น 400 (missing email) ให้ throw error
      if (error.statusCode === 400) {
        throw error;
      }
    }

    // สำหรับ error อื่นๆ ให้ return false (ไม่มีอีเมลซ้ำ)
    return {
      exists: false,
      email: (getQuery(event).email as string)?.trim() || "",
    };
  }
});
