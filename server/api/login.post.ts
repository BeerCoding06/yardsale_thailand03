// server/api/login.post.ts
// Handle user login using WordPress REST API

import * as wpUtils from '../utils/wp';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { username, password } = body;

    if (!username || !password) {
      return sendError(
        event,
        createError({
          statusCode: 400,
          message: "Username and password are required",
        })
      );
    }

    // Use WordPress REST API to verify credentials
    // We'll use Basic Auth with username:password to authenticate
    const wpBaseUrl = wpUtils.getWpBaseUrl();
    const authString = `${username.trim()}:${password}`;
    const auth = Buffer.from(authString).toString('base64');

    // Try to authenticate by calling /wp-json/wp/v2/users/me
    const meUrl = `${wpBaseUrl}/wp-json/wp/v2/users/me`;

    console.log("[login] Authenticating via WordPress REST API:", meUrl);

    try {
      const loginResponse = await fetch(meUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${auth}`,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (loginResponse.ok) {
        const userData = await loginResponse.json();
        
        // Remove sensitive data
        const { password: _, ...safeUserData } = userData;

        console.log("[login] Login successful for user:", userData.id);

        return {
          success: true,
          user: safeUserData,
          message: "Login successful",
        };
      } else {
        // Login failed - invalid credentials
        const errorText = await loginResponse.text().catch(() => "");
        let errorMessage = "Invalid username or password";
        
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.message) errorMessage = errorJson.message;
        } catch (e) {
          // Use default message
        }

        return sendError(
          event,
          createError({
            statusCode: 401,
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
