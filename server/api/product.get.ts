// server/api/product.get.ts
// Fetch single product using WooCommerce REST API: /wp-json/wc/v3/products/{id}

import * as wpUtils from '../utils/wp';

export default cachedEventHandler(
  async (event) => {
    try {
      const query = getQuery(event);
      
      const slug = query.slug as string | undefined;
      const sku = query.sku as string | undefined;
      const id = query.id as string | undefined;
      
      if (!slug && !sku && !id) {
        return { product: null };
      }
      
      // Check WooCommerce credentials first
      const consumerKey = wpUtils.getWpConsumerKey();
      const consumerSecret = wpUtils.getWpConsumerSecret();
      
      if (!consumerKey || !consumerSecret) {
        console.error('[product] WooCommerce API credentials not configured');
        return { product: null };
      }
      
      let productId: number | null = null;
      let wcProduct: any = null;
      
      // If ID is provided directly, use it
      if (id) {
        productId = parseInt(id);
        if (isNaN(productId)) {
          return { product: null };
        }
      }
      
      // Try to find product by slug using WooCommerce API
      if (!productId && slug) {
        try {
          const wcUrl = wpUtils.buildWcApiUrl('wc/v3/products', {
            slug: slug,
            per_page: 1,
            status: 'publish'
          });
          
          console.log('[product] Searching by slug from WooCommerce API:', wcUrl.replace(/consumer_secret=[^&]+/, 'consumer_secret=***'));
          
          const wcResponse = await fetch(wcUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10000),
          });
          
          if (wcResponse.ok) {
            const wcData = await wcResponse.json();
            if (Array.isArray(wcData) && wcData.length > 0) {
              productId = wcData[0].id;
              wcProduct = wcData[0]; // Use the product data directly
              console.log(`[product] Found product by slug ${slug} (ID: ${productId})`);
            }
          } else {
            const errorText = await wcResponse.text().catch(() => '');
            console.warn(`[product] WooCommerce API error for slug ${slug}:`, wcResponse.status, errorText.substring(0, 200));
          }
        } catch (e) {
          console.error('[product] Error fetching by slug:', e);
        }
      }
      
      // If not found by slug, try by SKU using WooCommerce API
      if (!productId && sku) {
        try {
          const wcUrl = wpUtils.buildWcApiUrl('wc/v3/products', {
            sku: sku,
            per_page: 1,
            status: 'publish'
          });
          
          console.log('[product] Searching by SKU from WooCommerce API:', wcUrl.replace(/consumer_secret=[^&]+/, 'consumer_secret=***'));
          
          const wcResponse = await fetch(wcUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10000),
          });
          
          if (wcResponse.ok) {
            const wcData = await wcResponse.json();
            if (Array.isArray(wcData) && wcData.length > 0) {
              productId = wcData[0].id;
              wcProduct = wcData[0]; // Use the product data directly
              console.log(`[product] Found product by SKU ${sku} (ID: ${productId})`);
            }
          } else {
            const errorText = await wcResponse.text().catch(() => '');
            console.warn(`[product] WooCommerce API error for SKU ${sku}:`, wcResponse.status, errorText.substring(0, 200));
          }
        } catch (e) {
          console.error('[product] Error fetching by SKU:', e);
        }
      }
      
      // If we have productId but not full product data, fetch it using /wp-json/wc/v3/products/{id}
      if (productId && !wcProduct) {
        try {
          const wcUrl = wpUtils.buildWcApiUrl(`wc/v3/products/${productId}`);
          console.log(`[product] Fetching product ${productId} from WooCommerce API:`, wcUrl.replace(/consumer_secret=[^&]+/, 'consumer_secret=***'));
          
          const wcResponse = await fetch(wcUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10000),
          });
          
          console.log(`[product] WooCommerce API response for product ${productId}:`, wcResponse.status);
          
          if (wcResponse.ok) {
            wcProduct = await wcResponse.json();
            console.log(`[product] WooCommerce product data for ${productId}:`, {
              id: wcProduct.id,
              name: wcProduct.name,
              regular_price: wcProduct.regular_price,
              sale_price: wcProduct.sale_price,
              stock_quantity: wcProduct.stock_quantity,
              stock_status: wcProduct.stock_status,
            });
          } else {
            const errorText = await wcResponse.text().catch(() => '');
            console.error(`[product] WooCommerce API error for product ${productId}:`, wcResponse.status, errorText.substring(0, 200));
            return { product: null };
          }
        } catch (e) {
          console.error(`[product] Error fetching WooCommerce data for product ${productId}:`, e);
          return { product: null };
        }
      }
      
      if (!wcProduct || !productId) {
        console.log('[product] Product not found after all attempts.');
        return { product: null };
      }
      
      // Get featured image from WooCommerce API
      let imageUrl: string | null = null;
      if (wcProduct.images && Array.isArray(wcProduct.images) && wcProduct.images.length > 0) {
        imageUrl = wcProduct.images[0].src || null;
      }
      
      // Get gallery images from WooCommerce API
      const galleryImages: any[] = [];
      if (wcProduct.images && Array.isArray(wcProduct.images)) {
        for (const img of wcProduct.images) {
          if (img.src) {
            galleryImages.push({ sourceUrl: img.src });
          }
        }
      }
      
      // Get prices from WooCommerce API
      let regularPrice = '';
      let salePrice: string | null = null;
      let productSku = wcProduct.sku || wcProduct.slug || `product-${productId}`;
      let stockQuantity: number | null = null;
      let stockStatus = 'IN_STOCK';
      
      {
        // Check regular_price (can be string, number, or null)
        const regularPriceValue = wcProduct.regular_price !== null && wcProduct.regular_price !== undefined && wcProduct.regular_price !== ''
          ? wcProduct.regular_price 
          : (wcProduct.price !== null && wcProduct.price !== undefined && wcProduct.price !== '' ? wcProduct.price : null);
        
        if (regularPriceValue !== null && regularPriceValue !== undefined && regularPriceValue !== '') {
          const price = parseFloat(String(regularPriceValue));
          if (!isNaN(price) && price > 0) {
            regularPrice = `<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>${Math.round(price).toLocaleString()}</span>`;
          }
        }
        
        // Check sale_price (can be string, number, or null)
        const salePriceValue = wcProduct.sale_price !== null && wcProduct.sale_price !== undefined && wcProduct.sale_price !== ''
          ? wcProduct.sale_price 
          : null;
        
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
        if (wcProduct.sku) {
          productSku = wcProduct.sku;
        }
        if (wcProduct.stock_quantity !== null && wcProduct.stock_quantity !== undefined) {
          stockQuantity = parseInt(wcProduct.stock_quantity);
        }
        if (wcProduct.stock_status) {
          stockStatus = wcProduct.stock_status.toUpperCase();
        }
      
      // Get PA Style and PA Color attributes from WooCommerce API
      const paStyle: any[] = [];
      const paColor: any[] = [];
      if (wcProduct.attributes && Array.isArray(wcProduct.attributes)) {
        for (const attr of wcProduct.attributes) {
          if (attr.slug === 'pa_color' && attr.options && Array.isArray(attr.options)) {
            paColor.push(...attr.options.map((opt: string) => ({ name: opt })));
          } else if (attr.slug === 'pa_style' && attr.options && Array.isArray(attr.options)) {
            paStyle.push(...attr.options.map((opt: string) => ({ name: opt })));
          }
        }
      }
      
      // Get related products from WooCommerce API (same categories)
      const relatedProducts: any[] = [];
      try {
        if (wcProduct.categories && Array.isArray(wcProduct.categories) && wcProduct.categories.length > 0) {
          const mainCategoryId = wcProduct.categories[0].id; // Use the first category for related products
          const relatedUrl = wpUtils.buildWcApiUrl('wc/v3/products', {
            category: mainCategoryId,
            per_page: 10,
            exclude: productId,
            status: 'publish',
          });
          
          console.log('[product] Fetching related products from WooCommerce API:', relatedUrl.replace(/consumer_secret=[^&]+/, 'consumer_secret=***'));
          
          const relatedResponse = await fetch(relatedUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10000),
          });
          
          if (relatedResponse.ok) {
            const relatedData = await relatedResponse.json();
            for (const relatedProd of Array.isArray(relatedData) ? relatedData : []) {
              let relatedImageUrl: string | null = null;
              if (relatedProd.images && Array.isArray(relatedProd.images) && relatedProd.images.length > 0) {
                relatedImageUrl = relatedProd.images[0].src || null;
              }
              
              // Format prices
              let relatedRegularPrice = '';
              let relatedSalePrice: string | null = null;
              
              let relatedRegularPriceValue: string | number | null = null;
              if (relatedProd.regular_price !== null && relatedProd.regular_price !== undefined && relatedProd.regular_price !== '') {
                relatedRegularPriceValue = relatedProd.regular_price;
              } else if (relatedProd.price !== null && relatedProd.price !== undefined && relatedProd.price !== '') {
                relatedRegularPriceValue = relatedProd.price;
              }
              
              if (relatedRegularPriceValue !== null && relatedRegularPriceValue !== undefined && relatedRegularPriceValue !== '') {
                const price = parseFloat(String(relatedRegularPriceValue));
                if (!isNaN(price) && price > 0) {
                  relatedRegularPrice = `<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>${Math.round(price).toLocaleString()}</span>`;
                }
              }
              
              let relatedSalePriceValue: string | number | null = null;
              if (relatedProd.sale_price !== null && relatedProd.sale_price !== undefined && relatedProd.sale_price !== '') {
                relatedSalePriceValue = relatedProd.sale_price;
              }
              
              if (relatedSalePriceValue !== null && relatedSalePriceValue !== undefined && relatedSalePriceValue !== '') {
                const price = parseFloat(String(relatedSalePriceValue));
                if (!isNaN(price) && price > 0) {
                  const regularPriceNum = relatedRegularPriceValue ? parseFloat(String(relatedRegularPriceValue)) : 0;
                  if (price < regularPriceNum || regularPriceNum === 0) {
                    relatedSalePrice = `<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>${Math.round(price).toLocaleString()}</span>`;
                  }
                }
              }
              
              relatedProducts.push({
                sku: relatedProd.sku || relatedProd.slug || `product-${relatedProd.id}`,
                slug: relatedProd.slug,
                name: relatedProd.name || '',
                regularPrice: relatedRegularPrice,
                salePrice: relatedSalePrice,
                allPaStyle: { nodes: [] },
                image: relatedImageUrl ? { sourceUrl: relatedImageUrl } : null,
                galleryImages: { nodes: relatedImageUrl ? [{ sourceUrl: relatedImageUrl }] : [] },
              });
            }
          } else {
            const errorText = await relatedResponse.text().catch(() => '');
            console.warn('[product] Error fetching related products:', relatedResponse.status, errorText.substring(0, 200));
          }
        }
      } catch (e) {
        console.warn('[product] Error fetching related products:', e);
      }
      
      // Get variations from WooCommerce API
      const variations: any[] = [];
      if (wcProduct.variations && Array.isArray(wcProduct.variations)) {
        for (const variationId of wcProduct.variations) {
          try {
            const wcVariationUrl = wpUtils.buildWcApiUrl(`wc/v3/products/${productId}/variations/${variationId}`);
            console.log('[product] Fetching variation from WooCommerce API:', wcVariationUrl.replace(/consumer_secret=[^&]+/, 'consumer_secret=***'));
            
            const wcVariationResponse = await fetch(wcVariationUrl, {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
              signal: AbortSignal.timeout(5000),
            });
            
            if (wcVariationResponse.ok) {
              const wcVariation = await wcVariationResponse.json();
              let variationImageUrl: string | null = null;
              if (wcVariation.image?.src) {
                variationImageUrl = wcVariation.image.src;
              }
              
              let variationRegularPrice = '';
              let variationSalePrice: string | null = null;
              
              let variationRegularPriceValue: string | number | null = null;
              if (wcVariation.regular_price !== null && wcVariation.regular_price !== undefined && wcVariation.regular_price !== '') {
                variationRegularPriceValue = wcVariation.regular_price;
              } else if (wcVariation.price !== null && wcVariation.price !== undefined && wcVariation.price !== '') {
                variationRegularPriceValue = wcVariation.price;
              }
              
              if (variationRegularPriceValue !== null && variationRegularPriceValue !== undefined && variationRegularPriceValue !== '') {
                const price = parseFloat(String(variationRegularPriceValue));
                if (!isNaN(price) && price > 0) {
                  variationRegularPrice = `<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>${Math.round(price).toLocaleString()}</span>`;
                }
              }
              
              let variationSalePriceValue: string | number | null = null;
              if (wcVariation.sale_price !== null && wcVariation.sale_price !== undefined && wcVariation.sale_price !== '') {
                variationSalePriceValue = wcVariation.sale_price;
              }
              
              if (variationSalePriceValue !== null && variationSalePriceValue !== undefined && variationSalePriceValue !== '') {
                const price = parseFloat(String(variationSalePriceValue));
                if (!isNaN(price) && price > 0) {
                  const regularPriceNum = variationRegularPriceValue ? parseFloat(String(variationRegularPriceValue)) : 0;
                  if (price < regularPriceNum || regularPriceNum === 0) {
                    variationSalePrice = `<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>${Math.round(price).toLocaleString()}</span>`;
                  }
                }
              }
              
              variations.push({
                databaseId: wcVariation.id,
                salePrice: variationSalePrice,
                regularPrice: variationRegularPrice,
                stockQuantity: wcVariation.stock_quantity !== null && wcVariation.stock_quantity !== undefined ? parseInt(wcVariation.stock_quantity) : null,
                stockStatus: (wcVariation.stock_status || 'instock').toUpperCase(),
                image: variationImageUrl ? { sourceUrl: variationImageUrl } : null,
                attributes: { nodes: wcVariation.attributes?.map((attr: any) => ({ value: attr.option })) || [] },
              });
            } else {
              const errorText = await wcVariationResponse.text().catch(() => '');
              console.warn(`[product] Error fetching variation ${variationId}:`, wcVariationResponse.status, errorText.substring(0, 200));
            }
          } catch (vError) {
            console.error(`[product] Error fetching variation ${variationId}:`, vError);
          }
        }
      }
      
      console.log(`[product] Successfully formatted product ${productId}`);
      
      return {
        product: {
          databaseId: productId,
          sku: productSku,
          slug: wcProduct.slug,
          name: wcProduct.name || '',
          description: wcProduct.description || '',
          regularPrice,
          salePrice,
          stockQuantity,
          stockStatus,
          status: wcProduct.status,
          image: imageUrl ? { sourceUrl: imageUrl } : null,
          galleryImages: { nodes: galleryImages },
          allPaColor: { nodes: paColor },
          allPaStyle: { nodes: paStyle },
          related: { nodes: relatedProducts },
          variations: { nodes: variations },
        }
      };
    } catch (error: any) {
      console.error('[product] Error:', error);
      return { product: null };
    }
  },
  {
    maxAge: 1,
    swr: false,
    getKey: event => event.req.url!,
  }
);
