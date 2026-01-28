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
      
      // Use WordPress REST API endpoint
      const apiUrl = wpUtils.buildWpApiUrl('wp/v2/product', {
        search: search,
        per_page: limit,
        status: 'publish',
        _embed: '1'
      });
      
      const headers = wpUtils.getWpApiHeaders(true, false);
      
      console.log('[search] Fetching from WordPress API:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(30000),
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('[search] WordPress API error:', response.status, errorText);
        return { products: { nodes: [] } };
      }
      
      const data = await response.json();
      
      // Try WooCommerce API first (faster - has price built-in)
      const consumerKey = wpUtils.getWpConsumerKey();
      const consumerSecret = wpUtils.getWpConsumerSecret();
      if (consumerKey && consumerSecret) {
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
              // Format prices
              let regularPrice = '';
              let salePrice: string | null = null;
              
              if (product.regular_price && product.regular_price !== '') {
                const price = parseFloat(product.regular_price);
                if (!isNaN(price) && price > 0) {
                  regularPrice = `<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>${Math.round(price).toLocaleString()}</span>`;
                }
              }
              
              if (product.sale_price && product.sale_price !== '') {
                const price = parseFloat(product.sale_price);
                if (!isNaN(price) && price > 0) {
                  salePrice = `<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>${Math.round(price).toLocaleString()}</span>`;
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
            
            return {
              products: {
                nodes: formattedProducts
              }
            };
          }
        } catch (wcError) {
          console.warn('[search] WooCommerce API error, using WordPress REST API:', wcError);
        }
      }
      
      // Fallback to WordPress REST API (no price)
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
      
      return {
        products: {
          nodes: formattedProducts
        }
      };
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
