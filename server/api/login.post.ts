// server/api/login.post.ts
// Handle user login via PHP API endpoint

import { executePhpScript } from '../utils/php-executor';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { username, password } = body;

    if (!username || !password) {
      throw createError({
        statusCode: 400,
        message: "Username and password are required",
      });
    }

    console.log("[login] Executing PHP script: login.php");
    console.log("[login] Username:", username);

    // Execute PHP script directly using PHP CLI
    const data = await executePhpScript({
      script: 'login.php',
      queryParams: {},
      method: 'POST',
      body: { username, password },
    });

    console.log("[login] PHP script response:", JSON.stringify(data).substring(0, 500));
    console.log("[login] Response success:", data?.success);
    console.log("[login] Response has user:", !!data?.user);
    console.log("[login] Response error:", data?.error);

    // Ensure response structure is correct
    if (!data || typeof data !== 'object') {
      console.error("[login] Invalid response structure:", data);
      throw createError({
        statusCode: 500,
        message: "Invalid response from login API",
      });
    }

    // If response has error field, it means login failed
    if (data.error && !data.success) {
      throw createError({
        statusCode: 401,
        message: data.error || "Login failed",
        data: { error: data.error }
      });
    }

    return data;
  } catch (error: any) {
    console.error("[login] Error:", error.message || error);
    
    if (error.statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      message: error.message || "Failed to process login request",
    });
  }
});
