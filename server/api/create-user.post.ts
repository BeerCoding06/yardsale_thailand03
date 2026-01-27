// server/api/create-user.post.ts
// สร้างผู้ใช้ใหม่ใน WordPress

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    console.log("[create-user] Received payload:", body);

    const wpUtils = await import('../utils/wp');
    
    const cleanBase = wpUtils.getWpBaseUrl();
    const headers = wpUtils.getWpApiHeaders(true, false);
    
    if (!headers['Authorization']) {
      throw createError({
        statusCode: 500,
        message: "WP_BASIC_AUTH is not configured",
      });
    }

    // WordPress Users REST API endpoint
    const usersUrl = wpUtils.buildWpApiUrl('wp/v2/users');

    // ตรวจสอบอีเมลและ username ซ้ำก่อนสร้าง user
    const checkEmail = body?.email?.trim().toLowerCase();
    const checkUsername = body?.username?.trim();

    if (checkEmail) {
      // ตรวจสอบอีเมลซ้ำ - ใช้ search endpoint
      const searchEmailUrl = wpUtils.buildWpApiUrl('wp/v2/users', {
        search: checkEmail,
        per_page: '100'
      });
      try {
        const searchEmailResp = await fetch(searchEmailUrl, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(10000),
        });

        if (searchEmailResp.ok) {
          const users = await searchEmailResp.json();
          // ตรวจสอบว่ามีอีเมลซ้ำหรือไม่ (ตรวจสอบแบบ case-insensitive)
          const emailExists = users.some(
            (user: any) =>
              typeof user.email === "string" &&
              user.email.trim().toLowerCase() === checkEmail
          );
          if (emailExists) {
            console.log("[create-user] Email already exists:", checkEmail);
            return sendError(
              event,
              createError({
                statusCode: 409,
                message: "อีเมลนี้ถูกใช้งานแล้วในระบบ",
              })
            );
          }
        }
      } catch (searchError) {
        console.warn("[create-user] Error checking email:", searchError);
        // ถ้า search error ให้ไปสร้างต่อ WordPress จะตรวจสอบเอง
      }
    }

    // ตรวจสอบ username ซ้ำ
    if (checkUsername) {
      const searchUsernameUrl = wpUtils.buildWpApiUrl('wp/v2/users', {
        search: checkUsername,
        per_page: '100'
      });
      try {
        const searchUsernameResp = await fetch(searchUsernameUrl, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(10000),
        });

        if (searchUsernameResp.ok) {
          const users = await searchUsernameResp.json();
          // ตรวจสอบว่ามี username ซ้ำหรือไม่
          const usernameExists = users.some(
            (user: any) =>
              typeof user.username === "string" &&
              user.username.trim().toLowerCase() === checkUsername.toLowerCase()
          );
          if (usernameExists) {
            console.log(
              "[create-user] Username already exists:",
              checkUsername
            );
            return sendError(
              event,
              createError({
                statusCode: 409,
                message: "ชื่อผู้ใช้นี้ถูกใช้งานแล้วในระบบ",
              })
            );
          }
        }
      } catch (searchError) {
        console.warn("[create-user] Error checking username:", searchError);
        // ถ้า search error ให้ไปสร้างต่อ WordPress จะตรวจสอบเอง
      }
    }

    console.log("[create-user] Creating user at:", usersUrl);

    const response = await fetch(usersUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let errorMessage = `WordPress API error (status ${response.status})`;
      let statusCode = response.status;

      try {
        const errorJson = JSON.parse(errorText);

        // Map ข้อความบางอย่างของ WordPress ให้เป็นภาษาไทยและรหัสเหมาะสม (โดยเฉพาะ 400)
        if (
          errorJson.code === "existing_user_email" ||
          errorJson.code === "email_exists" ||
          (errorJson.message &&
            errorJson.message.toLowerCase().includes("email"))
        ) {
          errorMessage = "อีเมลนี้ถูกใช้งานแล้วในระบบ";
          statusCode = 409;
        } else if (
          errorJson.code === "rest_user_invalid_password" ||
          (errorJson.message &&
            (errorJson.message.toLowerCase().includes("password") ||
              errorJson.message.toLowerCase().includes("รหัสผ่าน")))
        ) {
          errorMessage =
            "รหัสผ่านไม่ถูกต้อง หรือไม่ปลอดภัย กรุณากรอกใหม่อีกครั้ง";
          statusCode = 400;
        } else if (
          errorJson.code === "rest_invalid_param" ||
          errorJson.code === "invalid_param" ||
          statusCode === 400
        ) {
          errorMessage = "ข้อมูลที่ส่งมาไม่ถูกต้อง กรุณาตรวจสอบข้อมูล";
          statusCode = 400;
        } else if (errorJson.message) {
          errorMessage = errorJson.message;
        }
        if (errorJson.code) {
          errorMessage = `${errorMessage} (${errorJson.code})`;
        }
        if (errorJson.data && errorJson.data.params) {
          errorMessage = `${errorMessage}: ${JSON.stringify(
            errorJson.data.params
          )}`;
        }
      } catch (e) {
        if (errorText) {
          errorMessage = `${errorMessage}: ${errorText.substring(0, 200)}`;
        }
      }

      console.error("[create-user] Error:", errorMessage);

      // สำคัญ: ถ้ามีข้อความไทยว่าอีเมลซ้ำหรือเรา detect ได้ว่า duplicate email ให้ส่ง 409 เสมอ
      if (
        errorMessage.includes("อีเมลนี้ถูกใช้งานแล้วในระบบ") ||
        statusCode === 409
      ) {
        return sendError(
          event,
          createError({
            statusCode: 409,
            message: "อีเมลนี้ถูกใช้งานแล้วในระบบ",
          })
        );
      }

      // กรณี 400 Bad Request จาก WordPress (บางทีจะได้ error: "ข้อมูลที่ส่งมาไม่ถูกต้อง")
      if (statusCode === 400) {
        return sendError(
          event,
          createError({
            statusCode: 400,
            message: errorMessage.includes("ข้อมูลที่ส่งมาไม่ถูกต้อง")
              ? "ข้อมูลที่ส่งมาไม่ถูกต้อง กรุณาตรวจสอบข้อมูล"
              : errorMessage ||
                "เกิดข้อผิดพลาด กรุณาตรวจสอบข้อมูลที่ส่งไป WordPress",
          })
        );
      }

      // ส่ง error อื่นปกติ
      return sendError(
        event,
        createError({
          statusCode,
          message: errorMessage,
        })
      );
    }

    const userData = await response.json();
    console.log("[create-user] User created successfully:", {
      id: userData.id,
      username: userData.username,
      email: userData.email,
    });

    return userData;
  } catch (error: any) {
    console.error("[create-user] Error:", error);

    // ถ้า error 409 ด้วย message อีเมลซ้ำ ให้แจ้ง user ไทย
    if (
      error?.statusCode === 409 ||
      (typeof error.message === "string" &&
        error.message.includes("อีเมลนี้ถูกใช้งานแล้วในระบบ"))
    ) {
      return sendError(
        event,
        createError({
          statusCode: 409,
          message: "อีเมลนี้ถูกใช้งานแล้วในระบบ",
        })
      );
    }
    // กรณี Bad Request (400)
    if (error?.statusCode === 400) {
      return sendError(
        event,
        createError({
          statusCode: 400,
          message: error?.message?.includes("ข้อมูลที่ส่งมาไม่ถูกต้อง")
            ? "ข้อมูลที่ส่งมาไม่ถูกต้อง กรุณาตรวจสอบข้อมูล"
            : error?.message ||
              "เกิดข้อผิดพลาด กรุณาตรวจสอบข้อมูลที่ส่งไป WordPress",
        })
      );
    }
    if (error?.statusCode) {
      return sendError(event, error);
    }
    return sendError(
      event,
      createError({
        statusCode: 500,
        message: error?.message || "Failed to create user",
      })
    );
  }
});
