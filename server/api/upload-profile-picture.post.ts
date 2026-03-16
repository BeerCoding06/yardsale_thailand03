// server/api/upload-profile-picture.post.ts
// Upload profile picture using WordPress REST API (same as upload-image.post.ts)
// รองรับมือถือและ webp โดย infer MIME จากนามสกุลเมื่อ type ว่าง

import * as wpUtils from '../utils/wp';

const IMAGE_EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
};

function getImageMime(file: File): string {
  const t = (file.type || "").trim();
  if (t.startsWith("image/")) return t;
  const ext = (file.name || "").split(".").pop()?.toLowerCase();
  return (ext && IMAGE_EXT_MIME[ext]) || "image/jpeg";
}

export default defineEventHandler(async (event) => {
  try {
    const formData = await readFormData(event);
    const file = (formData.get("file") ?? formData.get("profile_picture")) as File | null;
    const userId = formData.get("user_id") as string | null;

    if (!file) {
      throw createError({
        statusCode: 400,
        message: "No file provided",
      });
    }

    const mimeType = getImageMime(file);
    const arrayBuffer = await file.arrayBuffer();
    const fileBlob = new Blob([new Uint8Array(arrayBuffer)], { type: mimeType });
    const fileToSend = new File([fileBlob], file.name, { type: mimeType });

    const headers = wpUtils.getWpApiHeaders(true, false); // Use Basic Auth for WP REST API

    if (!headers['Authorization']) {
      throw createError({
        statusCode: 500,
        message: "WP_BASIC_AUTH is not configured",
      });
    }

    // Upload image to WordPress Media Library
    const mediaUrl = wpUtils.buildWpApiUrl('wp/v2/media');

    const wpFormData = new FormData();
    wpFormData.append("file", fileToSend);

    console.log("[upload-profile-picture] Uploading to WordPress:", mediaUrl);
    console.log("[upload-profile-picture] File:", file.name, "type:", file.type, "->", mimeType, "size:", file.size);

    const response = await fetch(mediaUrl, {
      method: "POST",
      headers: {
        Authorization: headers['Authorization'], // Pass only Authorization header
      },
      body: wpFormData,
      signal: AbortSignal.timeout(60000), // 60 seconds for file upload
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let errorMessage = `WordPress API error (status ${response.status})`;

      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) errorMessage = errorJson.message;
      } catch (e) {
        if (errorText) errorMessage = `${errorMessage}: ${errorText.substring(0, 200)}`;
      }

      console.error("[upload-profile-picture] WordPress API Error:", errorMessage);
      throw createError({
        statusCode: response.status,
        message: errorMessage,
      });
    }

    const mediaData = await response.json();

    // If userId is provided, update user's avatar
    if (userId && mediaData.id) {
      try {
        const userUrl = wpUtils.buildWpApiUrl(`wp/v2/users/${userId}`);
        const updateResponse = await fetch(userUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            meta: {
              wp_user_avatar: mediaData.id
            }
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (updateResponse.ok) {
          console.log("[upload-profile-picture] Updated user avatar");
        }
      } catch (e) {
        console.warn("[upload-profile-picture] Error updating user avatar:", e);
      }
    }

    console.log("[upload-profile-picture] Successfully uploaded profile picture:", {
      id: mediaData.id,
      url: mediaData.source_url,
    });

    return {
      success: true,
      attachment_id: mediaData.id,
      image_url: mediaData.source_url,
      id: mediaData.id,
      src: mediaData.source_url,
      url: mediaData.source_url,
    };
  } catch (error: any) {
    console.error("[upload-profile-picture] Error:", error);
    
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

