// server/api/upload-image.post.ts
// Upload image to WordPress media library

export default defineEventHandler(async (event) => {
  try {
    const formData = await readFormData(event);
    const file = formData.get("file") as File;

    if (!file) {
      throw createError({
        statusCode: 400,
        message: "No file provided",
      });
    }

    const wpUtils = await import('../utils/wp');
    
    const cleanBase = wpUtils.getWpBaseUrl();
    
    // WordPress Media Library endpoint
    const mediaUrl = wpUtils.buildWpApiUrl('wp/v2/media');

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    // Use Uint8Array instead of Buffer for better compatibility
    const uint8Array = new Uint8Array(arrayBuffer);

    // Create FormData for WordPress
    // Use FormData with proper file handling
    const wpFormData = new FormData();

    // Create a Blob from the array buffer
    const fileBlob = new Blob([uint8Array], { type: file.type });
    const fileObj = new File([fileBlob], file.name, { type: file.type });
    wpFormData.append("file", fileObj);

    // Use Basic Auth for WordPress REST API
    const headers = wpUtils.getWpApiHeaders(true, false);

    if (!headers['Authorization']) {
      throw createError({
        statusCode: 500,
        message: "WP_BASIC_AUTH is not configured",
      });
    }

    console.log("[upload-image] Uploading to WordPress:", mediaUrl);
    console.log("[upload-image] File:", file.name, file.type, file.size);

    const response = await fetch(mediaUrl, {
      method: "POST",
      headers,
      body: wpFormData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let errorMessage = `WordPress API error (status ${response.status})`;

      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
          errorMessage = errorJson.message;
        }
      } catch (e) {
        if (errorText) {
          errorMessage = `${errorMessage}: ${errorText.substring(0, 200)}`;
        }
      }

      console.error("[upload-image] Error:", errorMessage);

      throw createError({
        statusCode: response.status,
        message: errorMessage,
      });
    }

    const result = await response.json();

    console.log("[upload-image] Success:", {
      id: result.id,
      url: result.source_url,
    });

    // Return the image URL
    return {
      id: result.id,
      src: result.source_url,
      url: result.source_url,
    };
  } catch (error: any) {
    console.error("[upload-image] Error:", error);

    if (error?.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      message: error?.message || "Failed to upload image",
    });
  }
});
