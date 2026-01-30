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

    // Execute PHP script directly using PHP CLI
    const data = await executePhpScript({
      script: 'login.php',
      queryParams: {},
      method: 'POST',
      body: { username, password },
    });

    console.log("[login] PHP script response:", data?.success ? 'Success' : 'Failed');

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
