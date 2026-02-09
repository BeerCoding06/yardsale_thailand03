// server/api/upload-image.post.ts
// Upload image to WordPress media library

import * as wpUtils from '../utils/wp';

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
    
    // Add title (optional but recommended)
    // Extract filename without extension for title
    const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
    wpFormData.append("title", fileNameWithoutExt);
    
    // Add alt text (optional)
    wpFormData.append("alt_text", fileNameWithoutExt);

    // Use Basic Auth for WordPress REST API
    // IMPORTANT: Don't set Content-Type header when sending FormData
    // Browser will automatically set it with the correct boundary
    const basicAuth = wpUtils.getWpBasicAuth();
    
    if (!basicAuth) {
      throw createError({
        statusCode: 500,
        message: "WP_BASIC_AUTH is not configured",
      });
    }
    
    // Encode Basic Auth
    let authString = basicAuth;
    if (authString.includes(':')) {
      authString = Buffer.from(authString).toString('base64');
    }
    
    // Only set Authorization header, let browser set Content-Type for FormData
    const headers: Record<string, string> = {
      'Authorization': `Basic ${authString}`,
    };

    console.log("[upload-image] Uploading to WordPress:", mediaUrl);
    console.log("[upload-image] File:", file.name, file.type, file.size);
    console.log("[upload-image] File size:", file.size, "bytes");

    const response = await fetch(mediaUrl, {
      method: "POST",
      headers,
      body: wpFormData,
      signal: AbortSignal.timeout(60000), // 60 seconds timeout for file upload
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let errorMessage = `WordPress API error (status ${response.status})`;

      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
          errorMessage = errorJson.message;
        } else if (errorJson.code) {
          errorMessage = `${errorJson.code}: ${errorJson.message || errorJson.data?.message || errorText}`;
        }
      } catch (e) {
        if (errorText) {
          errorMessage = `${errorMessage}: ${errorText.substring(0, 500)}`;
        }
      }

      console.error("[upload-image] WordPress API error:", response.status, errorMessage);
      console.error("[upload-image] Response headers:", Object.fromEntries(response.headers.entries()));
      console.error("[upload-image] Request URL:", mediaUrl);
      console.error("[upload-image] File details:", {
        name: file.name,
        type: file.type,
        size: file.size,
      });

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
