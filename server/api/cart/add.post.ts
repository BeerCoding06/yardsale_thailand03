// server/api/cart/add.post.ts
// Add product to cart using WooCommerce REST API

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const wpUtils = await import('../utils/wp');
    
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
    let productData: any = null;
    try {
      const wcHeaders = wpUtils.getWpApiHeaders(false, true);
      if (wcHeaders['Authorization']) {
        const wcUrl = wpUtils.buildWpApiUrl(`wc/v3/products/${productId}`);
        console.log('[cart/add] Fetching from WooCommerce API:', wcUrl);
        const wcResponse = await fetch(wcUrl, {
          method: 'GET',
          headers: wcHeaders,
          signal: AbortSignal.timeout(10000),
        });
        
        console.log('[cart/add] WooCommerce API response status:', wcResponse.status);
        
        if (wcResponse.ok) {
          productData = await wcResponse.json();
          console.log('[cart/add] WooCommerce product data:', {
            id: productData.id,
            name: productData.name,
            price: productData.price,
            regular_price: productData.regular_price,
            sale_price: productData.sale_price,
          });
        } else {
          const errorText = await wcResponse.text().catch(() => '');
          console.warn('[cart/add] WooCommerce API error:', wcResponse.status, errorText);
        }
      } else {
        console.warn('[cart/add] WooCommerce API credentials not configured');
      }
    } catch (e) {
      console.warn('[cart/add] Error fetching product from WooCommerce:', e);
    }
    
    // If WooCommerce API fails, try WordPress REST API
    if (!productData) {
      try {
        const wpUrl = wpUtils.buildWpApiUrl(`wp/v2/product/${productId}`, {
          _embed: '1'
        });
        console.log('[cart/add] Fetching from WordPress REST API:', wpUrl);
        const wpHeaders = wpUtils.getWpApiHeaders(true, false);
        const wpResponse = await fetch(wpUrl, {
          method: 'GET',
          headers: wpHeaders,
          signal: AbortSignal.timeout(10000),
        });
        
        console.log('[cart/add] WordPress REST API response status:', wpResponse.status);
        
        if (wpResponse.ok) {
          const wpProduct = await wpResponse.json();
          console.log('[cart/add] WordPress product data:', {
            id: wpProduct.id,
            name: wpProduct.title?.rendered,
            slug: wpProduct.slug,
          });
          
          // Get featured image
          let imageUrl: string | null = null;
          if (wpProduct._embedded?.['wp:featuredmedia']?.[0]?.source_url) {
            imageUrl = wpProduct._embedded['wp:featuredmedia'][0].source_url;
          }
          
          // Format product data to match expected structure
          productData = {
            id: wpProduct.id,
            name: wpProduct.title?.rendered || wpProduct.title || '',
            slug: wpProduct.slug,
            price: '0',
            regular_price: '0',
            sale_price: '',
            sku: wpProduct.slug || `product-${wpProduct.id}`,
            stock_quantity: null,
            stock_status: 'instock',
            image: imageUrl ? { src: imageUrl } : null,
          };
        } else {
          const errorText = await wpResponse.text().catch(() => '');
          console.warn('[cart/add] WordPress REST API error:', wpResponse.status, errorText);
        }
      } catch (e) {
        console.warn('[cart/add] Error fetching product from WordPress API:', e);
      }
    }
    
    // If still no product data, create minimal response
    if (!productData) {
      productData = {
        id: productId,
        name: `Product ${productId}`,
        slug: `product-${productId}`,
        price: '0',
        regular_price: '0',
        sale_price: '',
        sku: `product-${productId}`,
        stock_quantity: null,
        stock_status: 'instock',
        image: null,
      };
    }
    
    // Format price
    const regularPrice = productData.regular_price || productData.price || '0';
    const salePrice = productData.sale_price || '';
    const price = salePrice && parseFloat(salePrice) > 0 ? salePrice : regularPrice;
    
    // Format price HTML
    const priceValue = parseFloat(price);
    const regularPriceHtml = priceValue > 0
      ? `<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>${Math.round(priceValue).toLocaleString()}</span>`
      : '';
    
    const salePriceHtml = salePrice && parseFloat(salePrice) > 0
      ? `<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>${Math.round(parseFloat(salePrice)).toLocaleString()}</span>`
      : null;
    
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
          regularPrice: regularPriceHtml,
          salePrice: salePriceHtml,
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
    
    if (error.statusCode) {
      throw createError({
        statusCode: error.statusCode,
        message: error.message || 'Failed to add to cart',
        data: error.data || { error: error.message },
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
      message: error.message || 'Failed to add to cart',
      data: { error: error.message || 'Failed to add to cart' },
    });
  }
});
