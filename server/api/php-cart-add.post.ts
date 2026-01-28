// server/api/php-cart-add.post.ts
// Add product to cart via PHP API endpoint

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    
    const { productId } = body;
    
    if (!productId) {
      throw createError({
        statusCode: 400,
        message: 'productId is required',
      });
    }
    
    // Build PHP API URL
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const phpUrl = `${baseUrl}/server/api/php/addToCart.php`;
    
    console.log('[php-cart-add] Calling PHP API:', phpUrl);
    
    const response = await fetch(phpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[php-cart-add] PHP API error:', response.status, errorText);
      throw createError({
        statusCode: response.status,
        message: errorText || 'Failed to add to cart',
      });
    }
    
    const data = await response.json();
    
    return data;
  } catch (error: any) {
    console.error('[php-cart-add] Error:', error);
    
    if (error.statusCode) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to add to cart',
    });
  }
});
