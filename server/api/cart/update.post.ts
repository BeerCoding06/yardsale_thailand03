// server/api/cart/update.post.ts
// Update cart items (client-side cart management)

import * as wpUtils from '../utils/wp';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    
    const { items } = body;
    
    if (!items || !Array.isArray(items)) {
      throw createError({
        statusCode: 400,
        message: 'items array is required',
      });
    }
    
    // WooCommerce doesn't have a direct cart update API in REST API v3
    // The cart is managed client-side in localStorage
    // This endpoint just validates the request and returns success
    
    // Optionally validate product IDs and quantities
    for (const item of items) {
      const { key, quantity } = item;
      
      if (!key) {
        throw createError({
          statusCode: 400,
          message: 'item key is required',
        });
      }
      
      if (quantity < 0) {
        throw createError({
          statusCode: 400,
          message: 'quantity cannot be negative',
        });
      }
      
      // Extract product ID from key (format: simple-{id} or variation-{id})
      const match = key.match(/(?:simple|variation)-(\d+)/);
      if (match) {
        const productId = parseInt(match[1]);
        
        // Optionally verify product exists and check stock
        if (quantity > 0) {
          try {
            const wcHeaders = wpUtils.getWpApiHeaders(false, true);
            if (wcHeaders['Authorization']) {
              const wcUrl = wpUtils.buildWpApiUrl(`wc/v3/products/${productId}`);
              const wcResponse = await fetch(wcUrl, {
                method: 'GET',
                headers: wcHeaders,
                signal: AbortSignal.timeout(5000),
              });
              
              if (wcResponse.ok) {
                const product = await wcResponse.json();
                
                // Check stock if managing stock
                if (product.manage_stock && product.stock_quantity !== null) {
                  const stockQuantity = parseInt(product.stock_quantity);
                  if (quantity > stockQuantity) {
                    throw createError({
                      statusCode: 400,
                      message: `Insufficient stock. Only ${stockQuantity} available.`,
                      data: { error: `Insufficient stock. Only ${stockQuantity} available.` },
                    });
                  }
                }
                
                // Check stock status
                if (product.stock_status === 'outofstock') {
                  throw createError({
                    statusCode: 400,
                    message: 'Product is out of stock',
                    data: { error: 'Product is out of stock' },
                  });
                }
              }
            }
          } catch (e: any) {
            // If it's already a createError, re-throw it
            if (e.statusCode) {
              throw e;
            }
            // Otherwise, just log and continue (product might not exist in WooCommerce)
            console.warn('[cart/update] Error validating product:', e);
          }
        }
      }
    }
    
    console.log('[cart/update] Successfully updated cart items');
    
    return {
      success: true,
      message: 'Cart updated successfully',
    };
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
      data: { error: error.message || 'Failed to update cart' },
    });
  }
});
