// server/api/products.get.ts
// Fetch products from WordPress REST API

import { getWpBaseUrl, getWpApiHeaders, buildWpApiUrl } from '../utils/wp';

export default cachedEventHandler(
  async (event) => {
    try {
      const query = getQuery(event);
      const wpUtils = await import('../utils/wp');
      
      // Parse pagination from cursor
      let page = 1;
      const after = query.after as string | undefined;
      if (after) {
        try {
          const decoded = Buffer.from(after, 'base64').toString('utf-8');
          const match = decoded.match(/page:(\d+)/);
          if (match) {
            page = parseInt(match[1]);
          }
        } catch (e) {
          // Invalid cursor, use page 1
        }
      }
      
      // WordPress REST API endpoint for products
      const perPage = 21;
      const search = query.search as string | undefined;
      const category = query.category as string | undefined;
      const order = (query.order as string)?.toLowerCase() || 'desc';
      const orderby = (query.orderby as string)?.toLowerCase() || 'date';
      
      // Map orderby to WordPress REST API format
      const orderbyMap: Record<string, string> = {
        'date': 'date',
        'title': 'title',
        'price': 'date', // WordPress REST API doesn't support price ordering directly
        'rating': 'date',
        'popularity': 'date',
      };
      const wpOrderby = orderbyMap[orderby] || 'date';
      
      // Build query parameters
      const params: Record<string, string | number> = {
        per_page: perPage,
        page: page,
        order: order,
        orderby: wpOrderby,
        status: 'publish',
        _embed: '1', // Embed featured media and other linked resources
        ...(search ? { search: search } : {})
      };
      
      // Use WordPress REST API endpoint
      const apiUrl = wpUtils.buildWpApiUrl('wp/v2/product', params);
      
      // Use utility function for headers
      const headers = wpUtils.getWpApiHeaders(true, false);
      
      console.log('[products] Fetching from WordPress API:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(30000),
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('[products] WordPress API error:', response.status, errorText);
        return {
          products: {
            nodes: [],
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
          },
        };
      }
      
      let data = await response.json();
      
      // Filter by category if provided
      if (category && Array.isArray(data)) {
        // Fetch categories to match by name
        try {
          const categoriesUrl = wpUtils.buildWpApiUrl('wp/v2/product_cat', {
            search: category,
            per_page: 100
          });
          const categoriesResponse = await fetch(categoriesUrl, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(10000),
          });
          
          if (categoriesResponse.ok) {
            const categories = await categoriesResponse.json();
            const categoryIds = Array.isArray(categories) 
              ? categories.map((cat: any) => cat.id)
              : [];
            
            if (categoryIds.length > 0) {
              data = data.filter((product: any) => {
                const productCats = product.product_cat || [];
                return productCats.some((catId: number) => categoryIds.includes(catId));
              });
            }
          }
        } catch (catError) {
          console.warn('[products] Error filtering by category:', catError);
        }
      }
      
      // Get pagination info from headers
      const total = response.headers.get('X-WP-Total') ? parseInt(response.headers.get('X-WP-Total')!) : 0;
      const totalPages = response.headers.get('X-WP-TotalPages') ? parseInt(response.headers.get('X-WP-TotalPages')!) : 0;
      const hasNextPage = page < totalPages;
      
      // Format products to match expected structure
      const formattedProducts = await Promise.all(
        (Array.isArray(data) ? data : []).map(async (product: any) => {
          // Get featured image from _embedded
          let imageUrl: string | null = null;
          if (product._embedded?.['wp:featuredmedia']?.[0]?.source_url) {
            imageUrl = product._embedded['wp:featuredmedia'][0].source_url;
          } else if (product.featured_media) {
            // Fetch media if not embedded
            try {
              const mediaUrl = wpUtils.buildWpApiUrl(`wp/v2/media/${product.featured_media}`);
              const mediaResponse = await fetch(mediaUrl, {
                method: 'GET',
                headers,
                signal: AbortSignal.timeout(5000),
              });
              if (mediaResponse.ok) {
                const media = await mediaResponse.json();
                imageUrl = media.source_url || null;
              }
            } catch (e) {
              console.warn('[products] Error fetching media:', e);
            }
          }
          
          // Get gallery images from _embedded or fetch
          const galleryImages: any[] = [];
          // WordPress REST API doesn't provide gallery in standard response
          // We'll use featured image as gallery for now
          if (imageUrl) {
            galleryImages.push({ sourceUrl: imageUrl });
          }
          
          // Try to get price from WooCommerce API if available
          let regularPrice = '';
          let salePrice: string | null = null;
          let sku = product.slug || `product-${product.id}`;
          let stockQuantity: number | null = null;
          let stockStatus = 'IN_STOCK';
          
          // Try WooCommerce API for price and meta data
          try {
            const wcHeaders = wpUtils.getWpApiHeaders(false, true); // Use WooCommerce auth
            if (wcHeaders['Authorization']) {
              const wcUrl = wpUtils.buildWpApiUrl(`wc/v3/products/${product.id}`);
              const wcResponse = await fetch(wcUrl, {
                method: 'GET',
                headers: wcHeaders,
                signal: AbortSignal.timeout(5000),
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
                if (wcProduct.stock_quantity !== null && wcProduct.stock_quantity !== undefined) {
                  stockQuantity = parseInt(wcProduct.stock_quantity);
                }
                if (wcProduct.stock_status) {
                  stockStatus = wcProduct.stock_status.toUpperCase();
                }
              }
            }
          } catch (wcError) {
            console.warn('[products] Error fetching WooCommerce data:', wcError);
          }
          
          // Get product categories
          const productCats = product.product_cat || [];
          
          // Get PA Style attribute (if available in _embedded)
          const paStyle: any[] = [];
          
          return {
            id: product.id,
            databaseId: product.id,
            sku,
            slug: product.slug,
            name: product.title?.rendered || product.title || '',
            description: product.content?.rendered || product.content || '',
            regularPrice,
            salePrice,
            stockQuantity,
            stockStatus,
            image: imageUrl ? { sourceUrl: imageUrl } : null,
            galleryImages: { nodes: galleryImages },
            allPaStyle: { nodes: paStyle },
            link: product.link,
            status: product.status,
          };
        })
      );
      
      // Generate cursor for pagination
      const endCursor = hasNextPage 
        ? Buffer.from(`page:${page + 1}`).toString('base64')
        : null;
      
      console.log('[products] Formatted products:', formattedProducts.length);
      
      return {
        products: {
          nodes: formattedProducts,
          pageInfo: {
            hasNextPage,
            endCursor,
          },
        },
      };
    } catch (error: any) {
      console.error('[products] Error:', error);
      // Return empty data instead of throwing error to keep the app working
      return {
        products: {
          nodes: [],
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
        },
      };
    }
  },
  {
    maxAge: 1,
    swr: false,
    getKey: event => event.req.url!,
  }
);
