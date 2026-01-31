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
    console.log("[login] Response debug:", data?.debug);

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
        data: { 
          error: data.error,
          debug: data.debug || null // Include debug info if available
        }
      });
    }

    return data;
  } catch (error: any) {
    console.error("[login] Error:", error.message || error);
    console.error("[login] Error stack:", error.stack);
    console.error("[login] Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    // If error has data property, log it
    if (error.data) {
      console.error("[login] Error data:", error.data);
    }
    
    if (error.statusCode) {
      throw error;
    }
    
    // Extract more detailed error message
    let errorMessage = error.message || "Failed to process login request";
    if (error.data) {
      try {
        if (typeof error.data === 'string') {
          const errorData = JSON.parse(error.data);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } else if (error.data.error) {
          errorMessage = error.data.error;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    throw createError({
      statusCode: 500,
      message: errorMessage,
      data: error.data || error
    });
  }
});
