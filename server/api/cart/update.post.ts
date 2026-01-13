// server/api/cart/update.post.ts
// Use PHP API instead of GraphQL

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig();
    const baseUrl = config.baseUrl || 'http://localhost/yardsale_thailand';
    
    const body = await readBody(event);
    
    const phpApiUrl = `${baseUrl}/server/api/php/updateCartItem.php`;
    
    const response = await fetch(phpApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let errorMessage = `PHP API error (status ${response.status})`;
      let errorData = null;
      
      console.error('[cart/update] PHP API Error Response Status:', response.status);
      console.error('[cart/update] PHP API Error Response Text:', errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        console.error('[cart/update] PHP API Error JSON:', errorJson);
        
        // Prioritize error field, then message field
        if (errorJson.error) {
          errorMessage = String(errorJson.error);
        } else if (errorJson.message) {
          errorMessage = String(errorJson.message);
        } else if (errorText && errorText.trim() !== '') {
          errorMessage = errorText;
        }
        
        errorData = errorJson;
      } catch (e) {
        /* not JSON */
        console.error('[cart/update] Failed to parse error as JSON:', e);
        if (errorText && errorText.trim() !== '') {
          errorMessage = errorText;
        }
      }
      
      // Ensure we have a meaningful error message
      if (!errorMessage || errorMessage.trim() === '' || errorMessage.includes('PHP API error (status')) {
        errorMessage = `Failed to update cart (Error ${response.status})`;
      }
      
      console.error('[cart/update] Final Error Message:', errorMessage);
      throw createError({
        statusCode: response.status,
        message: errorMessage,
        data: errorData || { error: errorMessage },
      });
    }
    
    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('[cart/update] Error:', error);
    
    if (error.statusCode) {
      throw createError({
        statusCode: error.statusCode,
        message: error.message || 'Failed to update cart',
        data: error.data || { error: error.message },
      });
    }
    
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to update cart',
    });
  }
});
