// server/api/update-profile.post.ts
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const config = useRuntimeConfig();
    const baseUrl = config.baseUrl || "http://localhost/yardsale_thailand";

    const phpApiUrl = `${baseUrl}/server/api/php/updateProfile.php`;

    console.log("[update-profile] Calling PHP API:", phpApiUrl);

    const response = await fetch(phpApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let errorMessage = `PHP API error (status ${response.status})`;
      let errorDetails = null;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error) errorMessage = errorJson.error;
        else if (errorJson.message) errorMessage = errorJson.message;
        errorDetails = errorJson;
      } catch (e) {
        /* not JSON */
        errorMessage = errorText || errorMessage;
      }
      console.error("[update-profile] PHP API Error:", errorMessage);
      console.error("[update-profile] Error details:", errorDetails);
      throw createError({
        statusCode: response.status,
        message: errorMessage,
        data: errorDetails,
      });
    }

    const data = await response.json();
    console.log("[update-profile] Successfully updated profile");

    return data;
  } catch (error: any) {
    console.error("[update-profile] Error:", error);
    console.error("[update-profile] Error stack:", error.stack);
    
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

