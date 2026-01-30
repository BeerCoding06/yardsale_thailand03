// server/api/create-user.post.ts
// สร้างผู้ใช้ใหม่ใน WordPress via PHP API endpoint

import { executePhpScript } from '../utils/php-executor';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    console.log("[create-user] Received payload:", body);
    
    console.log('[create-user] Executing PHP script: createUser.php');
    
    // Execute PHP script directly using PHP CLI
    const data = await executePhpScript({
      script: 'createUser.php',
      body: body,
      method: 'POST',
    });
    
    console.log("[create-user] User created successfully:", {
      id: data?.id,
      username: data?.username,
      email: data?.email,
    });

    return data;
  } catch (error: any) {
    console.error("[create-user] Error:", error);

    // ถ้า error 409 ด้วย message อีเมลซ้ำ ให้แจ้ง user ไทย
    if (
      error?.statusCode === 409 ||
      (typeof error.message === "string" &&
        error.message.includes("อีเมลนี้ถูกใช้งานแล้วในระบบ"))
    ) {
      throw createError({
        statusCode: 409,
        message: "อีเมลนี้ถูกใช้งานแล้วในระบบ",
      });
    }
    // กรณี Bad Request (400)
    if (error?.statusCode === 400) {
      throw createError({
        statusCode: 400,
        message: error?.message?.includes("ข้อมูลที่ส่งมาไม่ถูกต้อง")
          ? "ข้อมูลที่ส่งมาไม่ถูกต้อง กรุณาตรวจสอบข้อมูล"
          : error?.message ||
            "เกิดข้อผิดพลาด กรุณาตรวจสอบข้อมูลที่ส่งไป WordPress",
      });
    }
    if (error?.statusCode) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: error?.message || "Failed to create user",
    });
  }
});
