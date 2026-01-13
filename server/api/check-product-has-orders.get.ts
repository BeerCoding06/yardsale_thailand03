// server/api/check-product-has-orders.get.ts
// Check if a product has been purchased (has orders)

export default defineCachedEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const productId = query.product_id;
    
    if (!productId) {
      throw createError({
        statusCode: 400,
        message: 'product_id is required',
      });
    }
    
    const config = useRuntimeConfig();
    const baseUrl = config.baseUrl || 'http://localhost/yardsale_thailand';
    
    const phpApiUrl = `${baseUrl}/server/api/php/checkProductHasOrders.php?product_id=${productId}`;
    
    const response = await fetch(phpApiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let errorMessage = `PHP API error (status ${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error) errorMessage = errorJson.error;
        else if (errorJson.message) errorMessage = errorJson.message;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      throw createError({
        statusCode: response.status,
        message: errorMessage,
      });
    }
    
    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('[check-product-has-orders] Error:', error);
    
    if (error.statusCode) {
      throw createError({
        statusCode: error.statusCode,
        message: error.message || 'Failed to check product orders',
      });
    }
    
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to check product orders',
    });
  }
}, {
  maxAge: 0.5, // Cache for 0.5 seconds (near real-time)
});

