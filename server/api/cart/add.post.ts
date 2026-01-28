// server/api/cart/add.post.ts
// Add product to cart using WooCommerce REST API

import * as wpUtils from '../../utils/wp';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    
    const { productId } = body;
    
    console.log('[cart/add] Received request:', { productId, body });
    
    if (!productId) {
      throw createError({
        statusCode: 400,
        message: 'productId is required',
      });
    }
    
    // WooCommerce doesn't have a direct cart API in REST API v3
    // We'll create a simple cart item response that matches the expected format
    // The cart is managed client-side in localStorage
    
    // Fetch product details from WooCommerce API to get price and other info
    // IMPORTANT: We MUST use WooCommerce API to get price data
    // WordPress REST API (wp/v2/product) does NOT have price fields
    const consumerKey = wpUtils.getWpConsumerKey();
    const consumerSecret = wpUtils.getWpConsumerSecret();
    
    if (!consumerKey || !consumerSecret) {
      throw createError({
        statusCode: 500,
        message: 'WooCommerce API credentials not configured. Price data is required for cart.',
      });
    }
    
    let productData: any = null;
    
    try {
      const wcUrl = wpUtils.buildWcApiUrl(`wc/v3/products/${productId}`);
      console.log('[cart/add] Fetching from WooCommerce API:', wcUrl.replace(/consumer_secret=[^&]+/, 'consumer_secret=***'));
      
      const wcResponse = await fetch(wcUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      
      console.log('[cart/add] WooCommerce API response status:', wcResponse.status);
      
      if (!wcResponse.ok) {
        const errorText = await wcResponse.text().catch(() => '');
        console.error('[cart/add] WooCommerce API error:', wcResponse.status, errorText);
        throw createError({
          statusCode: wcResponse.status,
          message: `Failed to fetch product from WooCommerce API: ${errorText.substring(0, 200)}`,
        });
      }
      
      productData = await wcResponse.json();
      console.log('[cart/add] WooCommerce product data:', {
        id: productData.id,
        name: productData.name,
        price: productData.price,
        regular_price: productData.regular_price,
        sale_price: productData.sale_price,
      });
    } catch (e: any) {
      console.error('[cart/add] Error fetching product from WooCommerce:', e);
      
      // If it's already a createError, re-throw it
      if (e?.statusCode) {
        throw e;
      }
      
      // Otherwise, throw a generic error
      throw createError({
        statusCode: 500,
        message: `Failed to fetch product data: ${e?.message || 'Unknown error'}`,
      });
    }
    
    // Validate that we have product data with price
    if (!productData) {
      throw createError({
        statusCode: 404,
        message: 'Product not found',
      });
    }
    
    // Format prices (handle string, number, null, empty string)
    let regularPrice = '';
    let salePrice: string | null = null;
    
    // Check regular_price (can be string, number, or null/empty string)
    let regularPriceValue: string | number | null = null;
    if (productData.regular_price !== null && productData.regular_price !== undefined && productData.regular_price !== '') {
      regularPriceValue = productData.regular_price;
    } else if (productData.price !== null && productData.price !== undefined && productData.price !== '') {
      regularPriceValue = productData.price;
    }
    
    if (regularPriceValue !== null && regularPriceValue !== undefined && regularPriceValue !== '') {
      const price = parseFloat(String(regularPriceValue));
      if (!isNaN(price) && price > 0) {
        regularPrice = `<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>${Math.round(price).toLocaleString()}</span>`;
      }
    }
    
    // Check sale_price (can be string, number, or null/empty string)
    let salePriceValue: string | number | null = null;
    if (productData.sale_price !== null && productData.sale_price !== undefined && productData.sale_price !== '') {
      salePriceValue = productData.sale_price;
    }
    
    if (salePriceValue !== null && salePriceValue !== undefined && salePriceValue !== '') {
      const price = parseFloat(String(salePriceValue));
      if (!isNaN(price) && price > 0) {
        // Only set salePrice if it's less than regularPrice
        const regularPriceNum = regularPriceValue ? parseFloat(String(regularPriceValue)) : 0;
        if (price < regularPriceNum || regularPriceNum === 0) {
          salePrice = `<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>${Math.round(price).toLocaleString()}</span>`;
        }
      }
    }
    
    // Create cart item key
    const key = `simple-${productId}`;
    
    // Format response to match expected structure
    const cartItem = {
      key,
      product: {
        node: {
          id: productData.id,
          databaseId: productData.id,
          name: productData.name,
          slug: productData.slug || `product-${productData.id}`,
          sku: productData.sku || productData.slug || `product-${productData.id}`,
          regularPrice: regularPrice,
          salePrice: salePrice,
          stockQuantity: productData.stock_quantity !== null && productData.stock_quantity !== undefined 
            ? parseInt(productData.stock_quantity) 
            : null,
          stockStatus: (productData.stock_status || 'instock').toUpperCase(),
          image: productData.image?.src 
            ? { sourceUrl: productData.image.src } 
            : null,
        }
      },
      quantity: 1,
    };
    
    console.log('[cart/add] Successfully added to cart:', {
      key,
      productId: productData.id,
      name: productData.name,
      quantity: 1,
    });
    
    console.log('[cart/add] Cart item structure:', JSON.stringify(cartItem, null, 2));
    
    return {
      addToCart: {
        cartItem,
      },
    };
  } catch (error: any) {
    console.error('[cart/add] Error:', error);
    console.error('[cart/add] Error details:', {
      message: error?.message,
      statusCode: error?.statusCode,
      data: error?.data,
      cause: error?.cause,
      stack: error?.stack,
    });
    
    // Don't expose internal error details to client
    const errorMessage = error?.message || 'Failed to add to cart';
    
    if (error.statusCode) {
      throw createError({
        statusCode: error.statusCode,
        message: errorMessage,
        data: { error: errorMessage },
      });
    }
    
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw createError({
        statusCode: 504,
        message: 'Request timeout. Please try again.',
        data: { error: 'Request timeout. Please try again.' },
      });
    }
    
    throw createError({
      statusCode: 500,
      message: errorMessage,
      data: { error: errorMessage },
    });
  }
});
