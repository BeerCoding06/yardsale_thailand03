// server/api/cart/add.post.ts
// Use PHP API instead of GraphQL for better compatibility with simple products

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const config = useRuntimeConfig();
    const baseUrl = config.baseUrl || 'http://localhost/yardsale_thailand';
    
    const phpApiUrl = `${baseUrl}/server/api/php/addToCart.php`;
    
    console.log('[cart/add] Calling PHP API:', phpApiUrl);
    console.log('[cart/add] Request body:', body);
    
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
      
      console.error('[cart/add] PHP API Error Response Status:', response.status);
      console.error('[cart/add] PHP API Error Response Text:', errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        console.error('[cart/add] PHP API Error JSON:', errorJson);
        
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
        console.error('[cart/add] Failed to parse error as JSON:', e);
        if (errorText && errorText.trim() !== '') {
          errorMessage = errorText;
        }
      }
      
      // Ensure we have a meaningful error message
      if (!errorMessage || errorMessage.trim() === '' || errorMessage.includes('PHP API error (status')) {
        errorMessage = `Failed to add product to cart (Error ${response.status})`;
      }
      
      console.error('[cart/add] Final Error Message:', errorMessage);
      throw createError({
        statusCode: response.status,
        message: errorMessage,
        data: errorData || { error: errorMessage },
      });
    }
    
    const data = await response.json();
    console.log('[cart/add] Successfully added to cart');
    
    return data;
  } catch (error: any) {
    console.error('[cart/add] Error:', error);
    console.error('[cart/add] Error details:', {
      statusCode: error.statusCode,
      message: error.message,
      data: error.data,
      name: error.name,
    });
    
    if (error.statusCode) {
      // Ensure we have a meaningful error message
      let errorMessage = error.message || 'Failed to add to cart';
      if (error.data?.error) {
        errorMessage = String(error.data.error);
      } else if (error.data?.message) {
        errorMessage = String(error.data.message);
      }
      
      throw createError({
        statusCode: error.statusCode,
        message: errorMessage,
        data: error.data || { error: errorMessage },
      });
    }
    
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw createError({
        statusCode: 504,
        message: 'Request timeout. Please try again.',
        data: { error: 'Request timeout. Please try again.' },
      });
    }
    
    // Ensure we have a meaningful error message for unknown errors
    let errorMessage = error.message || 'Failed to add to cart';
    if (typeof error === 'string') {
      errorMessage = error;
    }
    
    throw createError({
      statusCode: 500,
      message: errorMessage,
      data: { error: errorMessage },
    });
  }
});
