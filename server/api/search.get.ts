// server/api/search.get.ts
// Search products using WordPress REST API

import * as wpUtils from '../utils/wp';

export default cachedEventHandler(
  async (event) => {
    try {
      const query = getQuery(event);
      
      const search = (query.search as string) || '';
      const limit = parseInt(query.limit as string || '6');
      
      if (!search) {
        return { products: { nodes: [] } };
      }
      
      // Try WooCommerce API first (has price and stock built-in)
      const consumerKey = wpUtils.getWpConsumerKey();
      const consumerSecret = wpUtils.getWpConsumerSecret();
      let useWooCommerce = !!(consumerKey && consumerSecret);
      
      if (useWooCommerce) {
        try {
          const wcUrl = wpUtils.buildWcApiUrl('wc/v3/products', {
            search: search,
            per_page: limit,
            status: 'publish',
          });
          
          console.log('[search] Fetching from WooCommerce API (fast):', wcUrl.replace(/consumer_secret=[^&]+/, 'consumer_secret=***'));
          
          // No headers needed - authentication is via query params
          const wcHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          
          const wcResponse = await fetch(wcUrl, {
            method: 'GET',
            headers: wcHeaders,
            signal: AbortSignal.timeout(10000),
          });
          
          if (wcResponse.ok) {
            const wcData = await wcResponse.json();
            
            // Format WooCommerce products (already has price)
            const formattedProducts = (Array.isArray(wcData) ? wcData : []).map((product: any) => {
              // Format prices (handle string, number, null, empty string)
              let regularPrice = '';
              let salePrice: string | null = null;
              
              // Check regular_price
              let regularPriceValue: string | number | null = null;
              if (product.regular_price !== null && product.regular_price !== undefined && product.regular_price !== '') {
                regularPriceValue = product.regular_price;
              } else if (product.price !== null && product.price !== undefined && product.price !== '') {
                regularPriceValue = product.price;
              }
              
              if (regularPriceValue !== null && regularPriceValue !== undefined && regularPriceValue !== '') {
                const price = parseFloat(String(regularPriceValue));
                if (!isNaN(price) && price > 0) {
                  regularPrice = `<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>${Math.round(price).toLocaleString()}</span>`;
                }
              }
              
              // Check sale_price
              let salePriceValue: string | number | null = null;
              if (product.sale_price !== null && product.sale_price !== undefined && product.sale_price !== '') {
                salePriceValue = product.sale_price;
              }
              
              if (salePriceValue !== null && salePriceValue !== undefined && salePriceValue !== '') {
                const price = parseFloat(String(salePriceValue));
                if (!isNaN(price) && price > 0) {
                  const regularPriceNum = regularPriceValue ? parseFloat(String(regularPriceValue)) : 0;
                  if (price < regularPriceNum || regularPriceNum === 0) {
                    salePrice = `<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>${Math.round(price).toLocaleString()}</span>`;
                  }
                }
              }
              
              // Get image
              let imageUrl: string | null = null;
              if (product.images && Array.isArray(product.images) && product.images.length > 0) {
                imageUrl = product.images[0].src || null;
              }
              
              return {
                id: product.id,
                databaseId: product.id,
                sku: product.sku || product.slug || `product-${product.id}`,
                slug: product.slug,
                name: product.name || '',
                regularPrice,
                salePrice,
                image: imageUrl ? { sourceUrl: imageUrl } : null,
              };
            });
            
            console.log('[search] Formatted products (WooCommerce):', formattedProducts.length);
            return {
              products: {
                nodes: formattedProducts
              }
            };
          } else {
            const errorText = await wcResponse.text().catch(() => '');
            console.error('[search] WooCommerce API error (status:', wcResponse.status, '):', errorText.substring(0, 200));
            // If we have credentials but API failed, don't fallback (WordPress REST API has no price)
            // Return empty array instead
            if (consumerKey && consumerSecret) {
              console.error('[search] WooCommerce credentials configured but API failed. Cannot fallback to WordPress REST API (no price data).');
              return { products: { nodes: [] } };
            }
            // Only fallback if credentials are not configured
            useWooCommerce = false;
          }
        } catch (wcError) {
          console.error('[search] WooCommerce API error:', wcError);
          // If we have credentials but API failed, don't fallback (WordPress REST API has no price)
          // Return empty array instead
          if (consumerKey && consumerSecret) {
            console.error('[search] WooCommerce credentials configured but API error. Cannot fallback to WordPress REST API (no price data).');
            return { products: { nodes: [] } };
          }
          // Only fallback if credentials are not configured
          useWooCommerce = false;
        }
      }
      
      // Fallback to WordPress REST API ONLY if WooCommerce credentials are NOT configured
      // WARNING: WordPress REST API does NOT have price data
      if (!useWooCommerce) {
        console.warn('[search] WooCommerce credentials not configured. Falling back to WordPress REST API (WARNING: no price data available).');
        
        const apiUrl = wpUtils.buildWpApiUrl('wp/v2/product', {
          search: search,
          per_page: limit,
          status: 'publish',
          _embed: '1'
        });
        
        const headers = wpUtils.getWpApiHeaders(true, false);
        
        console.log('[search] Fetching from WordPress API (fallback):', apiUrl);
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(30000),
        });
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          console.error('[search] WordPress API error (fallback):', response.status, errorText);
          return { products: { nodes: [] } };
        }
        
        const data = await response.json();
        
        // Format products (no price data available)
        const formattedProducts = (Array.isArray(data) ? data : []).map((product: any) => {
          let imageUrl: string | null = null;
          if (product._embedded?.['wp:featuredmedia']?.[0]?.source_url) {
            imageUrl = product._embedded['wp:featuredmedia'][0].source_url;
          }
          
          return {
            id: product.id,
            databaseId: product.id,
            sku: product.slug || `product-${product.id}`,
            slug: product.slug,
            name: product.title?.rendered || product.title || '',
            regularPrice: '',
            salePrice: null,
            image: imageUrl ? { sourceUrl: imageUrl } : null,
          };
        });
        
        console.log('[search] Formatted products (WordPress fallback, no price):', formattedProducts.length);
        return {
          products: {
            nodes: formattedProducts
          }
        };
      }
    } catch (error: any) {
      console.error('[search] Error:', error);
      return { products: { nodes: [] } };
    }
  },
  {
    maxAge: 5, // Cache for 5 seconds (increased from 0.5 seconds)
    swr: true, // Enable stale-while-revalidate
    getKey: event => event.req.url!,
  }
);
