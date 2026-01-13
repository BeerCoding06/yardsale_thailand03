// server/api/login.post.ts
// Handle user login to WordPress

// Base64 encoding helper for Node.js
function base64Encode(str: string): string {
  if (typeof globalThis !== "undefined" && (globalThis as any).Buffer) {
    return (globalThis as any).Buffer.from(str).toString("base64");
  }
  // Fallback for environments without Buffer
  return btoa(str);
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { username, password, remember } = body;

    if (!username || !password) {
      return sendError(
        event,
        createError({
          statusCode: 400,
          message: "Username and password are required",
        })
      );
    }

    // Use custom PHP endpoint for login (uses wp_authenticate and wp_set_auth_cookie)
    // PHP file is in /server/api/php/login.php
    // Must call through MAMP/Apache (not Nuxt)
    const config = useRuntimeConfig();
    const baseUrl = config.baseUrl || "http://localhost/yardsale_thailand";
    const loginUrl = `${baseUrl}/server/api/php/login.php`;

    console.log("[login] Calling PHP API:", loginUrl);

    try {
      const loginResponse = await fetch(loginUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password,
          remember: remember || false,
        }),
        signal: AbortSignal.timeout(10000),
      });

      const responseData = await loginResponse.json();

      if (loginResponse.ok && responseData.success) {
        // Return user data (without sensitive information)
        return {
          success: true,
          user: responseData.user,
          message: responseData.message || "Login successful",
        };
      } else {
        // Login failed
        const errorMessage =
          responseData.message ||
          responseData.error ||
          "Invalid username or password";

        return sendError(
          event,
          createError({
            statusCode: loginResponse.status || 401,
            message: errorMessage,
          })
        );
      }
    } catch (fetchError: any) {
      console.error("[login] Fetch error:", fetchError);
      return sendError(
        event,
        createError({
          statusCode: 500,
          message:
            fetchError.message ||
            "Failed to connect to WordPress login endpoint",
        })
      );
    }
  } catch (error: any) {
    console.error("[login] Error:", error);
    if (error?.statusCode) {
      throw error;
    }
    return sendError(
      event,
      createError({
        statusCode: 500,
        message: error?.message || "Failed to process login request",
      })
    );
  }
});
