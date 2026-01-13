// server/api/upload-profile-picture.post.ts
export default defineEventHandler(async (event) => {
  try {
    const formData = await readFormData(event);
    const config = useRuntimeConfig();
    const baseUrl = config.baseUrl || "http://localhost/yardsale_thailand";

    const phpApiUrl = `${baseUrl}/server/api/php/uploadProfilePicture.php`;

    console.log("[upload-profile-picture] Calling PHP API:", phpApiUrl);

    // Convert FormData to a format that can be sent via fetch
    const formDataToSend = new FormData();
    for (const [key, value] of formData.entries()) {
      formDataToSend.append(key, value);
    }

    const response = await fetch(phpApiUrl, {
      method: "POST",
      body: formDataToSend,
      signal: AbortSignal.timeout(60000), // 60 seconds for file upload
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
      console.error("[upload-profile-picture] PHP API Error:", errorMessage);
      console.error("[upload-profile-picture] Error details:", errorDetails);
      throw createError({
        statusCode: response.status,
        message: errorMessage,
        data: errorDetails,
      });
    }

    const data = await response.json();
    console.log("[upload-profile-picture] Successfully uploaded profile picture");

    return data;
  } catch (error: any) {
    console.error("[upload-profile-picture] Error:", error);
    console.error("[upload-profile-picture] Error stack:", error.stack);
    
    if (error.statusCode) {
      throw createError({
        statusCode: error.statusCode,
        message: error.message || "Failed to upload profile picture",
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
      message: error.message || "Failed to upload profile picture",
    });
  }
});

