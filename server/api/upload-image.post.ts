// server/api/upload-image.post.ts
// Upload image to WordPress media library (supports JWT or WP Basic Auth)

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

    // Prefer JWT from request (logged-in user) so WordPress authorizes as that user
    // Accept token from header or FormData (in case header is stripped when sending FormData)
    const authHeader = getHeader(event, "authorization") || getHeader(event, "Authorization");
    const tokenFromForm = formData.get("token");
    const jwt =
      (authHeader?.replace(/^Bearer\s+/i, "").trim() || null) ||
      (typeof tokenFromForm === "string" ? tokenFromForm.trim() : null) ||
      null;

    const basicAuth = wpUtils.getWpBasicAuth();
    let authHeaderValue: string;

    if (jwt) {
      authHeaderValue = `Bearer ${jwt}`;
    } else if (basicAuth) {
      let authString = basicAuth;
      if (authString.includes(":")) {
        authString = Buffer.from(authString).toString("base64");
      }
      authHeaderValue = `Basic ${authString}`;
    } else {
      throw createError({
        statusCode: 401,
        message: "Authentication required. Please log in to upload images, or configure WP_BASIC_AUTH on the server.",
      });
    }

    // WordPress Media Library endpoint
    const mediaUrl = wpUtils.buildWpApiUrl("wp/v2/media");

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const wpFormData = new FormData();
    const fileBlob = new Blob([uint8Array], { type: file.type });
    const fileObj = new File([fileBlob], file.name, { type: file.type });
    wpFormData.append("file", fileObj);

    const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
    wpFormData.append("title", fileNameWithoutExt);
    wpFormData.append("alt_text", fileNameWithoutExt);

    // Do not set Content-Type so fetch sets it with the correct boundary for FormData
    const headers: Record<string, string> = {
      Authorization: authHeaderValue,
    };

    console.log("[upload-image] Uploading to WordPress:", mediaUrl);
    console.log("[upload-image] Auth:", jwt ? "JWT" : "Basic Auth");
    console.log("[upload-image] File:", file.name, file.type, file.size);

    let response = await fetch(mediaUrl, {
      method: "POST",
      headers,
      body: wpFormData,
      signal: AbortSignal.timeout(60000), // 60 seconds timeout for file upload
    });

    // Many WordPress setups don't accept JWT for wp/v2/media; retry with Basic Auth if we have it
    if (!response.ok && response.status === 401 && jwt && basicAuth) {
      console.log("[upload-image] 401 with JWT, retrying with Basic Auth");
      const retryFormData = new FormData();
      const retryFile = new File([fileBlob], file.name, { type: file.type });
      retryFormData.append("file", retryFile);
      retryFormData.append("title", fileNameWithoutExt);
      retryFormData.append("alt_text", fileNameWithoutExt);
      let authString = basicAuth;
      if (authString.includes(":")) {
        authString = Buffer.from(authString).toString("base64");
      }
      response = await fetch(mediaUrl, {
        method: "POST",
        headers: { Authorization: `Basic ${authString}` },
        body: retryFormData,
        signal: AbortSignal.timeout(60000),
      });
    }

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

      // Map common WordPress Thai auth message to clearer guidance
      if (response.status === 401 && (errorMessage.includes("รหัสผ่าน") || errorMessage.includes("password") || errorMessage.includes("incorrect"))) {
        errorMessage = "Upload not allowed: check WordPress user has permission to upload media and WP_BASIC_AUTH (application password) is correct.";
      }

      console.error("[upload-image] WordPress API error:", response.status, errorMessage);
      console.error("[upload-image] Request URL:", mediaUrl);

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
