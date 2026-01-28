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
      
      // Format products to match expected structure
      const formattedProducts = await Promise.all(
        (Array.isArray(data) ? data : []).map(async (product: any) => {
          // Get featured image
          let imageUrl: string | null = null;
          if (product._embedded?.['wp:featuredmedia']?.[0]?.source_url) {
            imageUrl = product._embedded['wp:featuredmedia'][0].source_url;
          }
          
          // Get price from WooCommerce if available
          let regularPrice = '';
          let salePrice: string | null = null;
          let sku = product.slug || `product-${product.id}`;
          
          try {
            const wcHeaders = wpUtils.getWpApiHeaders(false, true);
            if (wcHeaders['Authorization']) {
              const wcUrl = wpUtils.buildWpApiUrl(`wc/v3/products/${product.id}`);
              const wcResponse = await fetch(wcUrl, {
                method: 'GET',
                headers: wcHeaders,
                signal: AbortSignal.timeout(3000),
              });
              
              if (wcResponse.ok) {
                const wcProduct = await wcResponse.json();
                if (wcProduct.regular_price) {
                  const price = parseFloat(wcProduct.regular_price);
                  regularPrice = `<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>${Math.round(price).toLocaleString()}</span>`;
                }
                if (wcProduct.sale_price) {
                  const price = parseFloat(wcProduct.sale_price);
                  salePrice = `<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>${Math.round(price).toLocaleString()}</span>`;
                }
                if (wcProduct.sku) {
                  sku = wcProduct.sku;
                }
              }
            }
          } catch (e) {
            // Ignore errors for search results
          }
          
          return {
            id: product.id,
            databaseId: product.id,
            sku,
            slug: product.slug,
            name: product.title?.rendered || product.title || '',
            regularPrice,
            salePrice,
            image: imageUrl ? { sourceUrl: imageUrl } : null,
          };
        })
      );
      
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
    maxAge: 0.5,
    swr: false,
    getKey: event => event.req.url!,
  }
);
