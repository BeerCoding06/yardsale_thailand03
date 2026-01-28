// server/api/products.get.ts
// Fetch products from WooCommerce REST API (faster - includes price and stock)

import * as wpUtils from '../utils/wp';

export default cachedEventHandler(
  async (event) => {
    try {
      const query = getQuery(event);
      
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
      
      const perPage = 21;
      const search = query.search as string | undefined;
      const category = query.category as string | undefined;
      const order = (query.order as string)?.toLowerCase() || 'desc';
      const orderby = (query.orderby as string)?.toLowerCase() || 'date';
      
      // Map orderby to WooCommerce API format
      const orderbyMap: Record<string, string> = {
        'date': 'date',
        'title': 'title',
        'price': 'price',
        'rating': 'rating',
        'popularity': 'popularity',
      };
      const wcOrderby = orderbyMap[orderby] || 'date';
      
      // Try WooCommerce API first (has price and stock built-in)
      const wcHeaders = wpUtils.getWpApiHeaders(false, true);
      let useWooCommerce = !!wcHeaders['Authorization'];
      
      if (useWooCommerce) {
        try {
          // Build WooCommerce API params
          const wcParams: Record<string, string | number> = {
            per_page: perPage,
            page: page,
            order: order,
            orderby: wcOrderby,
            status: 'publish',
            ...(search ? { search: search } : {}),
            ...(category ? { category: category } : {})
          };
          
          const wcUrl = wpUtils.buildWpApiUrl('wc/v3/products', wcParams);
          console.log('[products] Fetching from WooCommerce API (fast):', wcUrl);
          
          const wcResponse = await fetch(wcUrl, {
            method: 'GET',
            headers: wcHeaders,
            signal: AbortSignal.timeout(15000),
          });
          
          if (wcResponse.ok) {
            const wcData = await wcResponse.json();
            const total = wcResponse.headers.get('X-WP-Total') ? parseInt(wcResponse.headers.get('X-WP-Total')!) : 0;
            const totalPages = wcResponse.headers.get('X-WP-TotalPages') ? parseInt(wcResponse.headers.get('X-WP-TotalPages')!) : 0;
            const hasNextPage = page < totalPages;
            
            // Format WooCommerce products (already has price and stock)
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
              
              // Get gallery images
              const galleryImages = (product.images || []).map((img: any) => ({
                sourceUrl: img.src
              }));
              
              return {
                id: product.id,
                databaseId: product.id,
                sku: product.sku || product.slug || `product-${product.id}`,
                slug: product.slug,
                name: product.name || '',
                description: product.description || '',
                regularPrice,
                salePrice,
                stockQuantity: product.stock_quantity !== null && product.stock_quantity !== undefined
                  ? parseInt(product.stock_quantity)
                  : null,
                stockStatus: (product.stock_status || 'instock').toUpperCase(),
                image: imageUrl ? { sourceUrl: imageUrl } : null,
                galleryImages: { nodes: galleryImages },
                allPaStyle: { nodes: [] },
                link: product.permalink || '',
                status: product.status,
              };
            });
            
            const endCursor = hasNextPage 
              ? Buffer.from(`page:${page + 1}`).toString('base64')
              : null;
            
            console.log('[products] Formatted products from WooCommerce:', formattedProducts.length);
            
            return {
              products: {
                nodes: formattedProducts,
                pageInfo: {
                  hasNextPage,
                  endCursor,
                },
              },
            };
          } else {
            console.warn('[products] WooCommerce API failed, falling back to WordPress REST API');
            useWooCommerce = false;
          }
        } catch (wcError) {
          console.warn('[products] WooCommerce API error, falling back to WordPress REST API:', wcError);
          useWooCommerce = false;
        }
      }
      
      // Fallback to WordPress REST API if WooCommerce not available
      if (!useWooCommerce) {
        const orderbyMap: Record<string, string> = {
          'date': 'date',
          'title': 'title',
          'price': 'date',
          'rating': 'date',
          'popularity': 'date',
        };
        const wpOrderby = orderbyMap[orderby] || 'date';
        
        const params: Record<string, string | number> = {
          per_page: perPage,
          page: page,
          order: order,
          orderby: wpOrderby,
          status: 'publish',
          _embed: '1',
          ...(search ? { search: search } : {})
        };
        
        const apiUrl = wpUtils.buildWpApiUrl('wp/v2/product', params);
        const headers = wpUtils.getWpApiHeaders(true, false);
        
        console.log('[products] Fetching from WordPress API (fallback):', apiUrl);
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(15000),
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
          try {
            const categoriesUrl = wpUtils.buildWpApiUrl('wp/v2/product_cat', {
              search: category,
              per_page: 100
            });
            const categoriesResponse = await fetch(categoriesUrl, {
              method: 'GET',
              headers,
              signal: AbortSignal.timeout(5000),
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
        
        const total = response.headers.get('X-WP-Total') ? parseInt(response.headers.get('X-WP-Total')!) : 0;
        const totalPages = response.headers.get('X-WP-TotalPages') ? parseInt(response.headers.get('X-WP-TotalPages')!) : 0;
        const hasNextPage = page < totalPages;
        
        // Format products (no price/stock from WordPress REST API)
        const formattedProducts = (Array.isArray(data) ? data : []).map((product: any) => {
          let imageUrl: string | null = null;
          if (product._embedded?.['wp:featuredmedia']?.[0]?.source_url) {
            imageUrl = product._embedded['wp:featuredmedia'][0].source_url;
          }
          
          const galleryImages: any[] = [];
          if (imageUrl) {
            galleryImages.push({ sourceUrl: imageUrl });
          }
          
          return {
            id: product.id,
            databaseId: product.id,
            sku: product.slug || `product-${product.id}`,
            slug: product.slug,
            name: product.title?.rendered || product.title || '',
            description: product.content?.rendered || product.content || '',
            regularPrice: '',
            salePrice: null,
            stockQuantity: null,
            stockStatus: 'IN_STOCK',
            image: imageUrl ? { sourceUrl: imageUrl } : null,
            galleryImages: { nodes: galleryImages },
            allPaStyle: { nodes: [] },
            link: product.link,
            status: product.status,
          };
        });
        
        const endCursor = hasNextPage 
          ? Buffer.from(`page:${page + 1}`).toString('base64')
          : null;
        
        return {
          products: {
            nodes: formattedProducts,
            pageInfo: {
              hasNextPage,
              endCursor,
            },
          },
        };
      }
    } catch (error: any) {
      console.error('[products] Error:', error);
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
    maxAge: 30, // Cache for 30 seconds (increased from 1 second)
    swr: true, // Enable stale-while-revalidate
    getKey: event => event.req.url!,
  }
);
